from typing import List, Dict, Any
from tavily import TavilyClient
from app.core.config import settings

def search_tavily(query: str, search_depth: str = "advanced", max_results: int = 5) -> List[Dict[str, Any]]:
    """
    Search the web using Tavily for real-time agricultural information.
    """
    if not settings.tavily_api_key:
        return [{"url": "N/A", "content": "Tavily API Key not configured. Please add TAVILY_API_KEY to your .env file."}]
    
    tavily = TavilyClient(api_key=settings.tavily_api_key)
    
    # We focus search on Indian agricultural contexts
    enhanced_query = f"{query} agriculture India wheat treatment"
    
    response = tavily.search(query=enhanced_query, search_depth=search_depth, max_results=max_results)
    
    results = []
    for result in response.get('results', []):
        results.append({
            "url": result.get('url'),
            "content": result.get('content'),
            "title": result.get('title')
        })
        
    return results

def format_tavily_results(results: List[Dict[str, Any]]) -> str:
    """Formats search results for LLM context."""
    formatted = []
    for r in results:
        formatted.append(f"Source: {r['url']}\nTitle: {r['title']}\nContent: {r['content']}")
    return "\n\n".join(formatted)
