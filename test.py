import os
import logging

from lightrag import LightRAG, QueryParam
from lightrag.llm import gpt_4o_mini_complete
#########
# Uncomment the below two lines if running in a jupyter notebook to handle the async nature of rag.insert()
# import nest_asyncio
# nest_asyncio.apply()
#########

WORKING_DIR = "./dickens"
if not os.path.exists(WORKING_DIR):
    os.mkdir(WORKING_DIR)

rag = LightRAG(
    working_dir=WORKING_DIR,
    llm_model_func=bedrock_complete,
    llm_model_name="Anthropic Claude 3 Haiku // Amazon Bedrock",
    embedding_func=EmbeddingFunc(
        embedding_dim=1024, max_token_size=8192, func=bedrock_embedding
    ),
)

with open("./dickens/book.txt", "r", encoding="utf-8") as f:
    rag.insert(f.read())

for mode in ["naive", "local", "global", "hybrid"]:
    print("\n+-" + "-" * len(mode) + "-+")
    print(f"| {mode.capitalize()} |")
    print("+-" + "-" * len(mode) + "-+\n")
    print(
        rag.query("What are the top themes in this story?", param=QueryParam(mode=mode))
    )