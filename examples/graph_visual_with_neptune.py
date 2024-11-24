import os
import json
from lightrag.utils import xml_to_json
from gremlin_python.driver import client
from gremlin_python.driver.protocol import GremlinServerError
import logging

# Constants
WORKING_DIR = "./dickens"
BATCH_SIZE_NODES = 500
BATCH_SIZE_EDGES = 100

# Neptune connection settings
NEPTUNE_ENDPOINT = "your-neptune-endpoint"
NEPTUNE_PORT = 8182

logger = logging.getLogger(__name__)

def convert_xml_to_json(xml_path, output_path):
    """Converts XML file to JSON and saves the output."""
    if not os.path.exists(xml_path):
        logger.error(f"Error: File not found - {xml_path}")
        return None

    json_data = xml_to_json(xml_path)
    if json_data:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        logger.info(f"JSON file created: {output_path}")
        return json_data
    else:
        logger.error("Failed to create JSON data")
        return None

def process_nodes_batch(g, nodes_batch):
    """Process a batch of nodes and add them to Neptune."""
    try:
        for node in nodes_batch:
            # Create vertex with properties
            query = (
                "g.addV('entity')"
                f".property('id', '{node['id']}')"
                f".property('entity_type', '{node['entity_type']}')"
                f".property('description', '{node['description']}')"
                f".property('source_id', '{node.get('source_id', '')}')"
                f".property('displayName', '{node['id']}')"
            )
            g.submit(query).all().result()
    except GremlinServerError as e:
        logger.error(f"Error processing nodes batch: {str(e)}")
        raise

def process_edges_batch(g, edges_batch):
    """Process a batch of edges and add them to Neptune."""
    try:
        for edge in edges_batch:
            # Determine relationship type from keywords
            keywords = edge['keywords'].lower()
            rel_type = 'relates_to'
            if 'lead' in keywords:
                rel_type = 'leads'
            elif 'participate' in keywords:
                rel_type = 'participates'
            elif 'uses' in keywords:
                rel_type = 'uses'
            elif 'located' in keywords:
                rel_type = 'located_in'
            elif 'occurs' in keywords:
                rel_type = 'occurs_in'
            else:
                # Use first keyword as relationship type
                keywords_list = edge['keywords'].replace('"', '').split(',')
                if keywords_list:
                    rel_type = keywords_list[0].strip().lower()

            # Create edge with properties
            query = (
                "g.V().has('entity', 'id', source)"
                ".as('source')"
                ".V().has('entity', 'id', target)"
                ".as('target')"
                f".addE('{rel_type}')"
                ".property('weight', weight)"
                ".property('description', description)"
                ".property('keywords', keywords)"
                ".property('source_id', source_id)"
                ".from('source').to('target')"
            )
            
            bindings = {
                'source': edge['source'],
                'target': edge['target'],
                'weight': float(edge.get('weight', 1.0)),
                'description': edge['description'],
                'keywords': edge['keywords'],
                'source_id': edge.get('source_id', '')
            }
            
            g.submit(query, bindings=bindings).all().result()
    except GremlinServerError as e:
        logger.error(f"Error processing edges batch: {str(e)}")
        raise

def process_in_batches(g, data, batch_size, process_func):
    """Process data in batches using the provided function."""
    for i in range(0, len(data), batch_size):
        batch = data[i:i + batch_size]
        process_func(g, batch)
        logger.info(f"Processed batch {i//batch_size + 1}")

def main():
    # Configure logging
    logging.basicConfig(level=logging.INFO)

    # Paths
    xml_file = os.path.join(WORKING_DIR, "graph_chunk_entity_relation.graphml")
    json_file = os.path.join(WORKING_DIR, "graph_data.json")

    # Convert XML to JSON
    json_data = convert_xml_to_json(xml_file, json_file)
    if json_data is None:
        return

    # Load nodes and edges
    nodes = json_data.get("nodes", [])
    edges = json_data.get("edges", [])

    # Create Gremlin client
    connection_string = f'wss://{NEPTUNE_ENDPOINT}:{NEPTUNE_PORT}/gremlin'
    
    try:
        gremlin_client = client.Client(connection_string, 'g')
        
        # Clear existing graph
        logger.info("Clearing existing graph...")
        gremlin_client.submit('g.V().drop()').all().result()

        # Process nodes in batches
        logger.info("Processing nodes...")
        process_in_batches(gremlin_client, nodes, BATCH_SIZE_NODES, process_nodes_batch)

        # Process edges in batches
        logger.info("Processing edges...")
        process_in_batches(gremlin_client, edges, BATCH_SIZE_EDGES, process_edges_batch)

        logger.info("Graph data loaded successfully")

    except Exception as e:
        logger.error(f"Error occurred: {str(e)}")
    
    finally:
        if 'gremlin_client' in locals():
            gremlin_client.close()

if __name__ == "__main__":
    main() 