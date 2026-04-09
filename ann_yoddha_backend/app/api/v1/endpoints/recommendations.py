"""
RAG-based treatment advice for detected wheat diseases.
Uses PageIndex vectorless RAG instead of Qdrant.
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
import json

from app.api.deps import CurrentUser
from app.core.supabase_client import get_supabase
from app.engines.rag.pageindex_retriever import answer_question_with_fallback, stream_answer_with_fallback

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


@router.get("/")
async def get_recommendations(disease: str, current_user: CurrentUser, severity: str | None = None):
    """
    Return treatment recommendations (chemical, organic, preventive) tailored for 
    Indian conditions using the latest uploaded PageIndex document.
    """
    supabase = get_supabase()
    
    # Try to grab the most recently indexed document by this user
    db_response = supabase.table("indexed_documents") \
        .select("structure, filename") \
        .eq("user_id", current_user.id) \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()
        
    if not db_response.data:
        # Fallback if no documents have been uploaded yet
        return {
            "disease": disease,
            "source": "Fallback (No PDFs Indexed)",
            "treatments": f"Please use the /indexing/process endpoint to upload an Indian wheat disease guide PDF. For {disease} at {severity} severity, standard Indian practices often include Propiconazole or Tebuconazole according to ICAR, but upload a document for specific LLM extraction!"
        }
    
    doc = db_response.data[0]
    structure_data = doc["structure"]
    
    if isinstance(structure_data, dict) and "structure" in structure_data:
        structure_list = structure_data["structure"]
    elif isinstance(structure_data, list):
        structure_list = structure_data
    else:
        structure_list = [structure_data]
        
    query = (
        f"The farmer's crop in India has been diagnosed with '{disease}' "
        f"{f'at {severity} severity' if severity else ''}. "
        "What are the specific recommended pesticides, dosages, and Indian farming practices to treat this disease based on the document?"
    )
        
    try:
        qa_result = answer_question_with_fallback(structure=structure_list, query=query)
        treatments = qa_result["answer"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
        
    return {
        "disease": disease,
        "source_document": doc["filename"],
        "treatments": treatments,
    }


@router.get("/stream")
async def stream_recommendations(disease: str, current_user: CurrentUser, severity: str | None = None):
    """
    Stream treatment recommendations using the Agentic AI logic (no database tool).
    """
    supabase = get_supabase()
    
    # Check for document
    db_response_doc = supabase.table("indexed_documents") \
        .select("structure, filename") \
        .eq("user_id", current_user.id) \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()
        
    has_doc = bool(db_response_doc.data)
    structure_list = []
    if has_doc:
         doc = db_response_doc.data[0]
         structure_data = doc["structure"]
         if isinstance(structure_data, dict) and "structure" in structure_data:
             structure_list = structure_data["structure"]
         elif isinstance(structure_data, list):
             structure_list = structure_data
         else:
             structure_list = [structure_data]

    from app.engines.rag.pageindex_retriever import _get_azure_client
    from app.core.config import settings

    async def event_generator():
        try:
            client = _get_azure_client()
            # ONLY Documentation tool for Diagnosis
            tools = [
                {
                    "type": "function",
                    "function": {
                        "name": "search_crop_manual",
                        "description": "Search the official Indian agricultural manual for treatment advice for a specific disease. Use this to find expert cure protocols.",
                        "parameters": {"type": "object", "properties": {}}
                    }
                }
            ]
            
            query = f"The crop has been diagnosed with '{disease}'. PROVIDE EXPERT TREATMENT RECOMMENDATIONS, pesticides, and dosages based on official Indian agriculture documentation."
            
            system_prompt = (
                "You are the Ann Yoddha Expert Diagnostic Agent. A crop has just been diagnosed with a specific condition. "
                "Your goal is to provide specific, expert treatment advice. "
                "CRITICAL: Detect the user's language from the context or profile and respond in that same language. "
                "You MUST use your tool to search the manual or web for the correct chemical/organic treatments."
            )
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query}
            ]

            yield f"data: {json.dumps({'event': 'status', 'message': f'Analyzing treatment for {disease}...'})}\n\n"
            
            response = client.chat.completions.create(
                model=settings.azure_openai_deployment,
                messages=messages,
                tools=tools,
                tool_choice="required", # Force it to search for diagnosis
                temperature=0.0,
                parallel_tool_calls=False
            )
            
            message = response.choices[0].message
            if message.tool_calls:
                tool_call = message.tool_calls[0]
                function_name = tool_call.function.name
                
                if function_name == "search_crop_manual":
                    if not has_doc:
                        msg = "Agricultural manual not found. Please upload a PDF first."
                        yield f"data: {json.dumps({'event': 'final_result', 'data': {'answer': msg}})}\n\n"
                        return
                    
                    async for event in stream_answer_with_fallback(structure=structure_list, query=query):
                        yield f"data: {json.dumps(event)}\n\n"
            else:
                answer = message.content or "No specific recommendation found."
                yield f"data: {json.dumps({'event': 'final_result', 'data': {'answer': answer}})}\n\n"
                
        except Exception as e:
            yield f"data: {json.dumps({'event': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("/chat/sessions")
def get_chat_sessions(current_user: CurrentUser):
    """Return distinct conversation sessions for the sidebar."""
    supabase = get_supabase()
    # Fetch all messages ordered oldest-first so we can group by session
    db_response = supabase.table("chat_messages") \
        .select("session_id, role, content, created_at") \
        .eq("user_id", current_user.id) \
        .not_.is_("session_id", "null") \
        .order("created_at", desc=False) \
        .execute()
    
    rows = db_response.data or []
    # Group by session_id, capture first user message and latest timestamp
    sessions: dict = {}
    for row in rows:
        sid = row["session_id"]
        if sid not in sessions:
            sessions[sid] = {"session_id": sid, "first_message": "", "created_at": row["created_at"], "message_count": 0}
        if row["role"] == "user":
            if not sessions[sid]["first_message"]:
                sessions[sid]["first_message"] = row["content"][:80]
            sessions[sid]["message_count"] += 1
        sessions[sid]["last_at"] = row["created_at"]
    
    # Sort by most recent first
    result = sorted(sessions.values(), key=lambda x: x.get("last_at", ""), reverse=True)
    return {"sessions": result}


@router.get("/chat/sessions/{session_id}/messages")
def get_session_messages(session_id: str, current_user: CurrentUser):
    """Return all messages for a specific session."""
    supabase = get_supabase()
    db_response = supabase.table("chat_messages") \
        .select("*") \
        .eq("user_id", current_user.id) \
        .eq("session_id", session_id) \
        .order("created_at", desc=False) \
        .execute()
    return {"messages": db_response.data or []}


@router.get("/chat/history")
def get_chat_history(current_user: CurrentUser, session_id: str | None = None, limit: int = 100):
    """Legacy: fetch messages. If session_id provided, scoped to that session."""
    supabase = get_supabase()
    q = supabase.table("chat_messages").select("*").eq("user_id", current_user.id)
    if session_id:
        q = q.eq("session_id", session_id)
    db_response = q.order("created_at", desc=False).limit(limit).execute()
    return {"history": db_response.data or []}

@router.get("/chat/stream")
async def chat_stream(query: str, current_user: CurrentUser, session_id: str | None = None):
    """
    Agentic Chatbot endpoint. Implements a ReAct-style Tool planner using native LLM Function Calling.
    Determines autonomously whether to:
    1. Reply directly (e.g. greetings)
    2. Query the personalized Supabase database `scan_history`
    3. Query the localized vectorless structural PDF
    """
    supabase = get_supabase()
    
    # Check for document
    db_response_doc = supabase.table("indexed_documents") \
        .select("structure, filename") \
        .eq("user_id", current_user.id) \
        .order("created_at", desc=True) \
        .limit(1) \
        .execute()
        
    has_doc = bool(db_response_doc.data)
    structure_list = []
    if has_doc:
        doc = db_response_doc.data[0]
        structure_data = doc["structure"]
        if isinstance(structure_data, dict) and "structure" in structure_data:
            structure_list = structure_data["structure"]
        elif isinstance(structure_data, list):
            structure_list = structure_data
        else:
            structure_list = [structure_data]
            
    from app.engines.rag.pageindex_retriever import _get_azure_client
    from app.core.config import settings

    async def event_generator():
        try:
            client = _get_azure_client()
            tools = [
                {
                    "type": "function",
                    "function": {
                        "name": "query_personal_database",
                        "description": "Fetch the user's personal crop scan history and diagnosis statistics from the database. Use this if the user asks about their past scans, crop health statistics, or any historical data.",
                        "parameters": {"type": "object", "properties": {}}
                    }
                },
                {
                    "type": "function",
                    "function": {
                        "name": "search_crop_manual",
                        "description": "Search the official Indian agricultural manual for wheat disease treatments, symptoms, and advice. Use this to answer agricultural queries. Falls back to web search automatically.",
                        "parameters": {"type": "object", "properties": {}}
                    }
                }
            ]
            
            # Check message cap (100 user queries per session)
            if session_id:
                count_resp = supabase.table("chat_messages") \
                    .select("id", count="exact") \
                    .eq("user_id", current_user.id) \
                    .eq("session_id", session_id) \
                    .eq("role", "user") \
                    .execute()
                count = count_resp.count or 0
                if count >= 100:
                    msg = "This conversation has reached the 100 message limit. Please start a new conversation."
                    yield f"data: {json.dumps({'event': 'final_result', 'data': {'answer': msg}})}\n\n"
                    return

            # Save user query to DB with session_id
            insert_payload: dict = {"user_id": current_user.id, "role": "user", "content": query}
            if session_id:
                insert_payload["session_id"] = session_id
            supabase.table("chat_messages").insert(insert_payload).execute()

            system_prompt = (
                "You are the Ann Yoddha AI Agronomist agent. Analyze the user's query and decide if you need to use a tool to answer it. "
                "CRITICAL: ALWAYS respond in the same language that the user is using. If they ask in Hindi, respond in Hindi. If Punjabi, respond in Punjabi. If English, respond in English. "
                "If you do not need a tool (e.g. for a simple greeting like 'hi'), answer naturally and friendly in their language."
            )
            messages = [{"role": "system", "content": system_prompt}]
            
            # Fetch last 10 messages from THIS session for context
            chat_history_resp = supabase.table("chat_messages") \
                .select("*") \
                .eq("user_id", current_user.id) \
                .eq("session_id", session_id) \
                .order("created_at", desc=True) \
                .limit(10) \
                .execute() if session_id else type('obj', (object,), {'data': []})() 
                
            past_msgs = (chat_history_resp.data or [])[::-1]
            past_db = [m for m in past_msgs if m["content"] != query or m["role"] != "user"]
            for m in past_db:
                r = "assistant" if m["role"] == "bot" else m["role"]
                messages.append({"role": r, "content": m["content"]})
                
            # append the current query
            messages.append({"role": "user", "content": query})

            yield f"data: {json.dumps({'event': 'status', 'message': 'Agent analyzing query...'})}\n\n"
            
            response = client.chat.completions.create(
                model=settings.azure_openai_deployment,
                messages=messages,
                tools=tools,
                tool_choice="auto",
                temperature=0.0,
                parallel_tool_calls=False
            )
            
            message = response.choices[0].message
            if message.tool_calls:
                tool_call = message.tool_calls[0]
                function_name = tool_call.function.name
                
                if function_name == "query_personal_database":
                    yield f"data: {json.dumps({'event': 'status', 'message': 'Retrieving data from your scan history...'})}\n\n"
                    db_response = supabase.table("scan_history") \
                        .select("*") \
                        .eq("user_id", current_user.id) \
                        .order("timestamp", desc=True) \
                        .limit(50) \
                        .execute()
                    
                    history_data = db_response.data or []
                    history_str = json.dumps(history_data, default=str)
                    
                    messages.append(message)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "name": "query_personal_database",
                        "content": f"Database results: {history_str}"
                    })
                    
                    yield f"data: {json.dumps({'event': 'status', 'message': 'Analyzing database records...'})}\n\n"
                    final_response = client.chat.completions.create(
                        model=settings.azure_openai_deployment,
                        messages=messages,
                        temperature=0.5
                    )
                    answer = final_response.choices[0].message.content or ""
                    bot_payload: dict = {"user_id": current_user.id, "role": "bot", "content": answer}
                    if session_id:
                        bot_payload["session_id"] = session_id
                    supabase.table("chat_messages").insert(bot_payload).execute()
                    yield f"data: {json.dumps({'event': 'final_result', 'data': {'answer': answer}})}\n\n"
                    
                elif function_name == "search_crop_manual":
                    if not has_doc:
                        msg = "Please upload an agricultural manual PDF first before asking for crop advice. Try the /indexing/process endpoint."
                        no_doc_payload: dict = {"user_id": current_user.id, "role": "bot", "content": msg}
                        if session_id:
                            no_doc_payload["session_id"] = session_id
                        supabase.table("chat_messages").insert(no_doc_payload).execute()
                        yield f"data: {json.dumps({'event': 'final_result', 'data': {'answer': msg}})}\n\n"
                        return
                    
                    last_answer = ""
                    async for event in stream_answer_with_fallback(structure=structure_list, query=query):
                        if event["event"] == "final_result" and "data" in event and "answer" in event["data"]:
                            last_answer = event["data"]["answer"]
                        yield f"data: {json.dumps(event)}\n\n"
                        
                    if last_answer:
                        rag_payload: dict = {"user_id": current_user.id, "role": "bot", "content": last_answer}
                        if session_id:
                            rag_payload["session_id"] = session_id
                        supabase.table("chat_messages").insert(rag_payload).execute()
            else:
                answer = message.content or "Hello! I am your AI Agronomist. How can I help you today?"
                greeting_payload: dict = {"user_id": current_user.id, "role": "bot", "content": answer}
                if session_id:
                    greeting_payload["session_id"] = session_id
                supabase.table("chat_messages").insert(greeting_payload).execute()
                yield f"data: {json.dumps({'event': 'final_result', 'data': {'answer': answer}})}\n\n"
                
        except Exception as e:
            yield f"data: {json.dumps({'event': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
