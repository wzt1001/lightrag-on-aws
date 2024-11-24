from fastapi import FastAPI, HTTPException, File, UploadFile
from pydantic import BaseModel
import os
import logging
from lightrag import LightRAG, QueryParam
from lightrag.llm import bedrock_complete, bedrock_embedding
from lightrag.utils import EmbeddingFunc
import numpy as np
from typing import Optional, Union
import asyncio
import nest_asyncio
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import networkx as nx
from pyvis.network import Network
import random
import shutil
import json
import uuid
from datetime import datetime
import uvicorn

# Configure logging
logging.getLogger("aiobotocore").setLevel(logging.INFO)

# Apply nest_asyncio to solve event loop issues
nest_asyncio.apply()

DEFAULT_RAG_DIR = "index_default"
app = FastAPI(title="LightRAG Bedrock API", description="API for RAG operations using Amazon Bedrock")

# Add CORS middleware with more permissive configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=False,  # Must be False if allow_origins is ["*"]
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
    expose_headers=["*"]  # Exposes all headers
)

# Configure working directory
WORKING_DIR = os.environ.get("RAG_DIR", f"{DEFAULT_RAG_DIR}")
print(f"WORKING_DIR: {WORKING_DIR}")
LLM_MODEL = os.environ.get("LLM_MODEL", "anthropic.claude-3-haiku-20240307-v1:0")
print(f"LLM_MODEL: {LLM_MODEL}")
EMBEDDING_MAX_TOKEN_SIZE = int(os.environ.get("EMBEDDING_MAX_TOKEN_SIZE", 8192))
print(f"EMBEDDING_MAX_TOKEN_SIZE: {EMBEDDING_MAX_TOKEN_SIZE}")

if not os.path.exists(WORKING_DIR):
    os.mkdir(WORKING_DIR)

# LLM model function
async def llm_model_func(
    prompt, system_prompt=None, history_messages=[], **kwargs
) -> str:
    return await bedrock_complete(
        prompt,
        system_prompt=system_prompt,
        history_messages=history_messages,
        **kwargs
    )

# Embedding function
async def embedding_func(texts: list[str]) -> np.ndarray:
    return await bedrock_embedding(texts)

async def get_embedding_dim():
    test_text = ["This is a test sentence."]
    embedding = await embedding_func(test_text)
    embedding_dim = embedding.shape[1]
    print(f"{embedding_dim=}")
    return embedding_dim

# Initialize RAG instance
rag = LightRAG(
    working_dir=WORKING_DIR,
    llm_model_func=llm_model_func,
    llm_model_name="Anthropic Claude 3 Haiku // Amazon Bedrock",
    embedding_func=EmbeddingFunc(
        embedding_dim=asyncio.run(get_embedding_dim()),
        max_token_size=EMBEDDING_MAX_TOKEN_SIZE,
        func=embedding_func
    ),
)

# Data models
class QueryRequest(BaseModel):
    query: str
    only_need_context: bool = False

class QueryResponse(BaseModel):
    naive: str
    local: str
    global_: str
    hybrid: str

class InsertRequest(BaseModel):
    text: str

class Response(BaseModel):
    status: str
    data: Optional[Union[str, QueryResponse]] = None
    message: Optional[str] = None

class ContextRequest(BaseModel):
    name: str
    description: Optional[str] = None

class ContextResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: str

def initialize_context_prompts(context_id: str):
    """Initialize prompts for a new context from template"""
    template_path = os.path.join(os.path.dirname(__file__), "../lightrag/prompts_template.json")
    context_prompts_path = os.path.join(WORKING_DIR, context_id, "prompts.json")
    
    # Copy template to context directory
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            template_prompts = json.load(f)
        
        with open(context_prompts_path, 'w', encoding='utf-8') as f:
            json.dump(template_prompts, f, indent=2, ensure_ascii=False)
            
    except Exception as e:
        raise Exception(f"Failed to initialize prompts for context: {str(e)}")

def load_context_prompts(context_id: str):
    """Load prompts for a specific context"""
    prompts_path = os.path.join(WORKING_DIR, context_id, "prompts.json")
    try:
        with open(prompts_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        raise Exception(f"Failed to load prompts for context: {str(e)}")

def save_context_prompts(context_id: str, prompts: dict):
    """Save prompts for a specific context"""
    prompts_path = os.path.join(WORKING_DIR, context_id, "prompts.json")
    try:
        with open(prompts_path, 'w', encoding='utf-8') as f:
            json.dump(prompts, f, indent=2, ensure_ascii=False)
    except Exception as e:
        raise Exception(f"Failed to save prompts for context: {str(e)}")

# Add this function to manage RAG instances
def get_rag_instance(context_id: str) -> LightRAG:
    context_dir = os.path.join(WORKING_DIR, context_id)
    if not os.path.exists(context_dir):
        raise HTTPException(status_code=404, detail="Context not found")
        
    # Load context-specific prompts
    try:
        prompts = load_context_prompts(context_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load prompts: {str(e)}")
    
    # Create a new RAG instance for this context
    rag = LightRAG(
        working_dir=context_dir,
        llm_model_func=llm_model_func,
        llm_model_name="Anthropic Claude 3 Haiku // Amazon Bedrock",
        embedding_func=EmbeddingFunc(
            embedding_dim=asyncio.run(get_embedding_dim()),
            max_token_size=EMBEDDING_MAX_TOKEN_SIZE,
            func=embedding_func
        ),
        prompts=prompts  # Pass the custom prompts
    )
    return rag

# API routes
@app.post("/query", response_model=Response)
async def query_endpoint(context_id: str, request: QueryRequest):
    try:
        rag = get_rag_instance(context_id)  # This now includes custom prompts
        
        loop = asyncio.get_event_loop()
        results = {}
        modes = {
            "naive": "naive",
            "local": "local", 
            "global": "global_",
            "hybrid": "hybrid"
        }
        
        for mode, result_key in modes.items():
            print(f"mode: {mode}")
            print(f"result_key: {result_key}")
            results[result_key] = await loop.run_in_executor(
                None,
                lambda m=mode: rag.query(
                    request.query,
                    param=QueryParam(
                        mode=m,
                        only_need_context=request.only_need_context
                    )
                )
            )
            print(f"results[result_key]: {results[result_key][:100]}")

        return Response(status="success", data=QueryResponse(**results))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/insert", response_model=Response)
async def insert_endpoint(context_id: str, request: InsertRequest):
    try:
        rag = get_rag_instance(context_id)
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: rag.insert(request.text))
        return Response(status="success", message="Text inserted successfully")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/insert_file", response_model=Response)
async def insert_file(context_id: str, file: UploadFile = File(...)):
    try:
        rag = get_rag_instance(context_id)
        file_content = await file.read()
        try:
            content = file_content.decode("utf-8")
        except UnicodeDecodeError:
            content = file_content.decode("gbk")
            
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, lambda: rag.insert(content))

        return Response(
            status="success",
            message=f"File content from {file.filename} inserted successfully",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/clear", response_model=Response)
async def clear_endpoint():
    try:
        # Clear the working directory
        if os.path.exists(WORKING_DIR):
            for file in os.listdir(WORKING_DIR):
                file_path = os.path.join(WORKING_DIR, file)
                try:
                    if os.path.isfile(file_path):
                        os.unlink(file_path)
                except Exception as e:
                    print(f'Error: {e}')
        
        # Reinitialize RAG instance
        global rag
        rag = LightRAG(
            working_dir=WORKING_DIR,
            llm_model_func=llm_model_func,
            llm_model_name="Anthropic Claude 3 Haiku // Amazon Bedrock",
            embedding_func=EmbeddingFunc(
                embedding_dim=asyncio.run(get_embedding_dim()),
                max_token_size=EMBEDDING_MAX_TOKEN_SIZE,
                func=embedding_func
            ),
        )
        
        return Response(status="success", message="All data cleared successfully")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/visualize")
async def visualize_endpoint(context_id: str, regenerate: bool = False):
    try:
        context_dir = os.path.join(WORKING_DIR, context_id)
        if not os.path.exists(context_dir):
            raise HTTPException(status_code=404, detail="Context not found")
            
        vis_path = os.path.join(context_dir, "knowledge_graph.html")
        graph_file = os.path.join(context_dir, "graph_chunk_entity_relation.graphml")
        
        # If visualization exists and regenerate is False, return existing file
        if os.path.exists(vis_path) and not regenerate:
            return FileResponse(
                vis_path,
                media_type="text/html",
                filename="knowledge_graph.html"
            )
            
        # Otherwise, check if we can generate a new visualization
        if not os.path.exists(graph_file):
            raise HTTPException(status_code=404, detail="No graph data available. Please upload content first.")

        # Generate new visualization
        G = nx.read_graphml(graph_file)
        net = Network(height="100vh", notebook=True)
        net.from_nx(G)
        
        # Add colors to nodes
        for node in net.nodes:
            node["color"] = "#{:06x}".format(random.randint(0, 0xFFFFFF))

        net.show(vis_path)

        return FileResponse(
            vis_path,
            media_type="text/html",
            filename="knowledge_graph.html"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/contexts", response_model=ContextResponse)
async def create_context(request: ContextRequest):
    try:
        context_id = str(uuid.uuid4())
        context_dir = os.path.join(WORKING_DIR, context_id)
        os.makedirs(context_dir, exist_ok=True)
        
        # Initialize prompts for this context
        initialize_context_prompts(context_id)
        
        # Save context metadata
        context_meta = {
            "id": context_id,
            "name": request.name,
            "description": request.description,
            "created_at": datetime.now().isoformat()
        }
        with open(os.path.join(context_dir, "metadata.json"), "w") as f:
            json.dump(context_meta, f)
            
        return ContextResponse(**context_meta)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/contexts")
async def list_contexts():
    try:
        contexts = []
        for item in os.listdir(WORKING_DIR):
            meta_path = os.path.join(WORKING_DIR, item, "metadata.json")
            if os.path.exists(meta_path):
                with open(meta_path) as f:
                    contexts.append(json.load(f))
        return {"contexts": contexts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get_prompt_variables")
async def get_prompt_variables(context_id: str):
    try:
        prompts = load_context_prompts(context_id)
        variables = []
        
        for name, value in prompts.items():
            var_type = "array" if isinstance(value, list) else "string"
            variables.append({
                "name": name,
                "type": var_type,
                "currentValue": value
            })
        
        return {"variables": variables}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/update_prompt")
async def update_prompt(context_id: str, request: dict):
    try:
        prompts = load_context_prompts(context_id)
        
        # Handle the value based on type
        if request["type"] == "array":
            value = request["value"] if isinstance(request["value"], list) else [request["value"]]
        else:
            value = request["value"]
        
        # Update the specified variable
        prompts[request["variable"]] = value
        
        # Save the updated prompts
        try:
            save_context_prompts(context_id, prompts)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save prompts: {str(e)}")
        
        return {
            "status": "success", 
            "message": f"Variable {request['variable']} updated successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/contexts/{context_id}")
async def delete_context(context_id: str):
    try:
        context_dir = os.path.join(WORKING_DIR, context_id)
        if not os.path.exists(context_dir):
            raise HTTPException(status_code=404, detail="Context not found")
            
        # Remove all files in the context directory
        shutil.rmtree(context_dir)
        
        return {
            "status": "success",
            "message": f"Context {context_id} deleted successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/contexts/{context_id}/clear", response_model=Response)
async def clear_context(context_id: str):
    try:
        context_dir = os.path.join(WORKING_DIR, context_id)
        if not os.path.exists(context_dir):
            raise HTTPException(status_code=404, detail="Context not found")
            
        # Clear only the RAG-related files, keeping context metadata and prompts
        for item in os.listdir(context_dir):
            if item not in ["metadata.json", "prompts.json"]:
                item_path = os.path.join(context_dir, item)
                if os.path.isfile(item_path):
                    os.unlink(item_path)
                elif os.path.isdir(item_path):
                    shutil.rmtree(item_path)
        
        # Reinitialize RAG for this context
        get_rag_instance(context_id)
        
        return Response(
            status="success",
            message=f"Context {context_id} data cleared successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/generated_files/{context_id}/{filename}")
async def get_generated_file(context_id: str, filename: str):
    try:
        context_dir = os.path.join(WORKING_DIR, context_id)
        if not os.path.exists(context_dir):
            raise HTTPException(status_code=404, detail="Context not found")
            
        file_path = os.path.join(context_dir, filename)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"File {filename} not found")
            
        with open(file_path, 'r') as f:
            content = f.read()
            
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/generated_files/{context_id}")
async def list_generated_files(context_id: str):
    try:
        context_dir = os.path.join(WORKING_DIR, context_id)
        if not os.path.exists(context_dir):
            raise HTTPException(status_code=404, detail="Context not found")
            
        # List of JSON files to look for
        json_files = [
            "kv_store_full_docs.json",
            "kv_store_text_chunks.json",
            "kv_store_llm_response_cache.json",
            "vdb_chunks.json",
            "vdb_entities.json",
            "vdb_relationships.json"
        ]
        
        available_files = []
        for filename in json_files:
            file_path = os.path.join(context_dir, filename)
            if os.path.exists(file_path):
                available_files.append(filename)
                
        return {"files": available_files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(
        "lightrag_api_bedrock_demo:app",  # Use module:app pattern
        host="0.0.0.0",
        port=8020,
        reload=True,  # Enable auto-reload
        reload_dirs=["./"]  # Watch current directory for changes
    )
# Usage example
# To run the server, use the following command in your terminal:
# python lightrag_api_bedrock_demo.py

# Make sure you have configured AWS credentials properly before running the server
# You can configure credentials using:
# - AWS CLI: aws configure
# - Environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
# - IAM role if running on AWS infrastructure

# Example requests:
# 1. Query:
# curl -X POST "http://127.0.0.1:8020/query" -H "Content-Type: application/json" -d '{"query": "your query here", "mode": "hybrid"}'

# 2. Insert text:
# curl -X POST "http://127.0.0.1:8020/insert" -H "Content-Type: application/json" -d '{"text": "your text here"}'

# 3. Insert file:
# curl -X POST "http://127.0.0.1:8020/insert_file" -F "file=@/path/to/your/file.txt"

# 4. Health check:
# curl -X GET "http://127.0.0.1:8020/health" 