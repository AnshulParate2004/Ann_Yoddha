import os
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
import json
import tempfile
from pydantic import BaseModel

from app.api.deps import CurrentUser
from app.core.supabase_client import get_supabase
from app.engines.rag.pageindex_retriever import build_pageindex_structure, answer_question


router = APIRouter()


class QARequest(BaseModel):
    document_id: str
    query: str


class QAResponse(BaseModel):
    answer: str
    nodes_used: list[str]
    selection_reasoning: str


@router.post("/process")
async def process_pdf(
    current_user: CurrentUser,
    file: UploadFile = File(...),
):
    """
    Upload a PDF, run PageIndex hierarchical indexing using LLMs, and save the structural JSON to Supabase.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Must upload a PDF file.")
    
    # Save the file temporarily to pass to the processing library
    temp_path = f"/tmp/{file.filename}"
    try:
        with open(temp_path, "wb") as f:
            f.write(await file.read())
            
        # Build the hierarchical structure
        structure_payload = build_pageindex_structure(temp_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {exc}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    # Save to Supabase
    supabase = get_supabase()
    db_response = supabase.table("indexed_documents").insert({
        "user_id": current_user.id,
        "filename": file.filename,
        "structure": structure_payload,
    }).execute()

    if not db_response.data:
        raise HTTPException(status_code=500, detail="Failed to save indexed structure to Supabase.")

    return {
        "status": "success",
        "document_id": db_response.data[0]["id"],
        "filename": file.filename,
        "structure": structure_payload
    }


@router.post("/stream-process")
async def stream_process_pdf(
    current_user: CurrentUser,
    file: UploadFile = File(...),
):
    """
    Upload a PDF and stream status updates while PageIndex indexes it.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Must upload a PDF file.")

    async def event_generator():
        try:
            yield f"data: {json.dumps({'event': 'status', 'message': f'Saving {file.filename}...'})}\n\n"
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                content = await file.read()
                tmp.write(content)
                temp_path = tmp.name

            try:
                yield f"data: {json.dumps({'event': 'status', 'message': 'Hierarchical indexing started. This takes ~30 seconds...'})}\n\n"
                structure_payload = build_pageindex_structure(temp_path)
                
                yield f"data: {json.dumps({'event': 'status', 'message': 'Saving structure to Supabase...'})}\n\n"
                supabase = get_supabase()
                db_response = supabase.table("indexed_documents").insert({
                    "user_id": current_user.id,
                    "filename": file.filename,
                    "structure": structure_payload,
                }).execute()

                if not db_response.data:
                    yield f"data: {json.dumps({'event': 'error', 'message': 'Failed to save to database'})}\n\n"
                    return

                yield f"data: {json.dumps({'event': 'final_result', 'data': {'document_id': db_response.data[0]['id'], 'filename': file.filename}})}\n\n"
            finally:
                if os.path.exists(temp_path):
                    os.remove(temp_path)
        except Exception as e:
            yield f"data: {json.dumps({'event': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/qa", response_model=QAResponse)
async def ask_question(
    payload: QARequest,
    current_user: CurrentUser,
):
    """
    Perform a vectorless QA on the indexed document structure using LLM reasoning.
    """
    supabase = get_supabase()
    db_response = supabase.table("indexed_documents") \
        .select("structure") \
        .eq("id", payload.document_id) \
        .eq("user_id", current_user.id) \
        .execute()
        
    if not db_response.data:
         raise HTTPException(status_code=404, detail="Indexed document not found.")
         
    structure_data = db_response.data[0]["structure"]
    
    # In some versions, the result might be wrapped in 'table_of_contents' or similar. 
    # Usually `structure` output from PageIndex is a list of node dicts.
    if isinstance(structure_data, dict) and "structure" in structure_data:
        structure_list = structure_data["structure"]
    elif isinstance(structure_data, list):
        structure_list = structure_data
    else:
        structure_list = [structure_data]
        
    try:
        qa_result = answer_question(structure=structure_list, query=payload.query)
        return qa_result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate answer: {exc}")
