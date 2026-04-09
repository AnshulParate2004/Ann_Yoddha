import os
import json
from typing import Any, Dict, List
from pathlib import Path

from openai import AzureOpenAI

from app.core.config import settings
from app.engines.pageindex.page_index import page_index
from app.engines.pageindex.utils import extract_json
from app.services.tavily_search import search_tavily, format_tavily_results


def _get_azure_client() -> AzureOpenAI:
    """Gets Azure OpenAI client for reasoning and RAG answers."""
    if not settings.azure_openai_api_key or not settings.azure_openai_endpoint:
        raise ValueError("Azure OpenAI is not configured.")
    return AzureOpenAI(
        api_key=settings.azure_openai_api_key,
        azure_endpoint=settings.azure_openai_endpoint,
        api_version=settings.openai_api_version,
    )


def build_pageindex_structure(pdf_path: str) -> Dict[str, Any]:
    """
    Build a PageIndex tree structure for the given PDF using the upstream PageIndex library.
    """
    # Expose the API key as OPENAI_API_KEY for the page index library.
    # While it's Azure, the page index library expects openai api key variable.
    os.environ["OPENAI_API_KEY"] = settings.azure_openai_api_key
    os.environ["CHATGPT_API_KEY"] = settings.azure_openai_api_key
    
    # Needs a normal model name, although Azure might use deployments, we'll try configuring it 
    # for standard behavior, or the user can map the deployment properly.
    abs_pdf_path = str(Path(pdf_path).resolve())

    result: Dict[str, Any] = page_index(
        doc=abs_pdf_path,
        model=settings.azure_openai_deployment, # using our azure deployment name
        toc_check_page_num=20,
        max_page_num_each_node=10,
        max_token_num_each_node=20000,
        if_add_node_id="yes",
        if_add_node_summary="yes",
        if_add_doc_description="yes",
        if_add_node_text="yes",
    )
    return result


def _select_relevant_nodes(
    structure: List[Dict[str, Any]],
    query: str,
    max_nodes: int = 8,
) -> tuple[List[str], str]:
    """Uses LLM to select the most relevant tree nodes for the query."""
    client = _get_azure_client()

    flat_nodes: List[Dict[str, Any]] = []

    def _walk(nodes):
        for node in nodes:
            flat_nodes.append(node)
            if node.get("nodes"):
                _walk(node["nodes"])

    _walk(structure)

    # Build prompt context
    lines: List[str] = []
    for node in flat_nodes[:128]:
        nid = node.get("node_id") or ""
        title = (node.get("title") or "").replace("\n", " ")
        summary = (node.get("summary") or "").replace("\n", " ")
        if len(summary) > 400:
            summary = summary[:400] + "..."
        lines.append(f"{nid}: {title} || {summary}")

    tree_text = "\n".join(lines)

    prompt = f"""
You are given a user query and a list of document nodes.
Each line describes one node as:
    node_id: title || summary

Select the most relevant node_ids that are likely to contain the answer.

Query:
{query}

Nodes:
{tree_text}

Reply ONLY in the following JSON format:
{{
  "thinking": "<brief reasoning>",
  "node_list": ["0001", "0002", ...]  // at most {max_nodes} node_ids
}}
"""
    response = client.chat.completions.create(
        model=settings.azure_openai_deployment,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    content = response.choices[0].message.content or ""
    try:
        parsed = extract_json(content)
        node_list = parsed.get("node_list", [])
    except Exception:
        node_list = []
        parsed = {}

    node_ids: List[str] = [str(n) for n in node_list]
    
    # Deduplicate
    seen = set()
    result: List[str] = []
    for nid in node_ids:
        if nid not in seen:
            seen.add(nid)
            result.append(nid)
        if len(result) >= max_nodes:
            break
            
    return result, parsed.get("thinking", "")


def answer_question(
    structure: List[Dict[str, Any]],
    query: str,
) -> Dict[str, Any]:
    """
    High-level QA entrypoint: vectorless PageIndex-style retrieval.
    """
    node_ids, selection_reasoning = _select_relevant_nodes(structure=structure, query=query)

    context_fragments: List[str] = []

    def _collect(nodes: List[Dict[str, Any]]):
        for node in nodes:
            if node.get("node_id") in node_ids:
                summary = node.get("summary") or ""
                title = node.get("title") or ""
                context_fragments.append(f"{title}\n{summary}")
            if node.get("nodes"):
                _collect(node["nodes"])

    _collect(structure)

    context_text = "\n\n".join(context_fragments).strip()

    if len(context_text) > 8000:
        context_text = context_text[:8000] + "\n...[truncated]..."

    qa_prompt = f"""
You are a helpful assistant answering questions about a document.

User question:
{query}

Relevant node summaries:
{context_text}

Instructions:
- Answer the question using ONLY the information provided above.
- Give a single, clear, direct answer.
- Do NOT repeat yourself or add a second paragraph restating your uncertainty after your answer.
- If the context does not contain enough information to answer, respond with exactly one sentence explaining that you could not find the answer in the document.
"""
    client = _get_azure_client()
    response = client.chat.completions.create(
        model=settings.azure_openai_deployment,
        messages=[{"role": "user", "content": qa_prompt}],
        temperature=0,
    )
    answer = response.choices[0].message.content or ""

    return {
        "answer": answer,
        "nodes_used": node_ids,
        "selection_reasoning": selection_reasoning,
    }


    return {
        "answer": web_answer,
        "nodes_used": [],
        "selection_reasoning": "Fallback to Tavily web search after document miss.",
        "source": "web_search",
        "web_results": search_results
    }


def answer_question_with_fallback(
    structure: List[Dict[str, Any]],
    query: str,
) -> Dict[str, Any]:
    """
    Synchronous version of answer_question_with_fallback.
    """
    # 1. Try Document QA
    doc_result = answer_question(structure, query)
    answer = doc_result["answer"]
    
    # Check if not found
    not_found_indicators = [
        "not find the answer in the document",
        "could not find the answer",
        "does not contain enough information",
        "no information available"
    ]
    is_not_found = any(indicator in answer.lower() for indicator in not_found_indicators)
    
    if not is_not_found:
        return {**doc_result, "source": "document"}
        
    # 2. Fallback to Tavily
    search_results = search_tavily(query)
    web_context = format_tavily_results(search_results)
    
    qa_prompt = f"""
You are a helpful agricultural assistant. The provided documents did not have the answer, 
so you have performed a web search for Indian agricultural advice.

User question:
{query}

Web Search Results:
{web_context}

Instructions:
- Provide a clear, direct answer based ONLY on the search results provided.
- Focus on practical advice for an Indian farmer.
- Mention that this info is from a web search fallback.
"""
    client = _get_azure_client()
    response = client.chat.completions.create(
        model=settings.azure_openai_deployment,
        messages=[{"role": "user", "content": qa_prompt}],
        temperature=0,
    )
    web_answer = response.choices[0].message.content or ""
    
    return {
        "answer": web_answer,
        "nodes_used": [],
        "selection_reasoning": "Fallback to Tavily web search after document miss.",
        "source": "web_search",
        "web_results": search_results
    }


async def stream_answer_with_fallback(
    structure: List[Dict[str, Any]],
    query: str,
):
    """
    Async generator that yields status events followed by the final QA result.
    Ideal for FastAPI StreamingResponse (SSE).
    """
    yield {"event": "status", "message": "Analyzing document structure..."}
    
    # 1. Selection
    node_ids, selection_reasoning = _select_relevant_nodes(structure=structure, query=query)
    yield {"event": "status", "message": f"Reasoning: {selection_reasoning}"}
    
    # 2. Document Answer Attempt
    yield {"event": "status", "message": "Reading relevant document sections..."}
    doc_result = answer_question(structure, query)
    answer = doc_result["answer"]
    
    # Check if not found
    not_found_indicators = [
        "not find the answer in the document",
        "could not find the answer",
        "does not contain enough information",
        "no information available"
    ]
    is_not_found = any(indicator in answer.lower() for indicator in not_found_indicators)
    
    if not is_not_found:
        yield {
            "event": "final_result", 
            "data": {**doc_result, "source": "document"}
        }
        return

    # 3. Tavily Fallback
    yield {"event": "status", "message": "Document search insufficient. Searching the web (Tavily)..."}
    search_results = search_tavily(query)
    web_context = format_tavily_results(search_results)
    
    yield {"event": "status", "message": "Synthesizing web search results..."}
    qa_prompt = f"""
You are a helpful agricultural assistant. The provided documents did not have the answer, 
so you have performed a web search for Indian agricultural advice.

User question:
{query}

Web Search Results:
{web_context}

Instructions:
- Provide a clear, direct answer based ONLY on the search results provided.
- Focus on practical advice for an Indian farmer.
- Mention that this info is from a web search fallback.
"""
    client = _get_azure_client()
    response = client.chat.completions.create(
        model=settings.azure_openai_deployment,
        messages=[{"role": "user", "content": qa_prompt}],
        temperature=0,
    )
    web_answer = response.choices[0].message.content or ""
    
    yield {
        "event": "final_result", 
        "data": {
            "answer": web_answer,
            "nodes_used": [],
            "selection_reasoning": "Fallback to Tavily web search.",
            "source": "web_search",
            "web_results": search_results
        }
    }
