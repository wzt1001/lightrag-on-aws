from gremlin_python.driver import client
from gremlin_python.driver.protocol import GremlinServerError
from gremlin_python.process.graph_traversal import __
from gremlin_python.process.traversal import T
import json
import os
import logging
from typing import Dict, List, Any

logger = logging.getLogger(__name__)

class NeptuneGraphManager:
    def __init__(self, endpoint: str, port: int = 8182):
        """
        Initialize Neptune graph manager
        
        Args:
            endpoint: Neptune cluster endpoint
            port: Neptune port (default 8182)
        """
        self.endpoint = endpoint
        self.port = port
        self.connection_string = f'wss://{endpoint}:{port}/gremlin'
        self.client = client.Client(self.connection_string, 'g')

    def clear_graph(self):
        """Clear all vertices and edges in the graph"""
        try:
            self.client.submit('g.V().drop()').all().result()
            logger.info("Graph cleared successfully")
        except GremlinServerError as e:
            logger.error(f"Error clearing graph: {str(e)}")
            raise

    def load_graph_from_files(self, context_dir: str):
        """
        Load graph data from JSON files in the context directory
        
        Args:
            context_dir: Directory containing the graph JSON files
        """
        try:
            # Load entities
            entities_file = os.path.join(context_dir, "vdb_entities.json")
            if os.path.exists(entities_file):
                with open(entities_file, 'r') as f:
                    entities = json.load(f)
                self._create_entities(entities)

            # Load relationships
            relationships_file = os.path.join(context_dir, "vdb_relationships.json")
            if os.path.exists(relationships_file):
                with open(relationships_file, 'r') as f:
                    relationships = json.load(f)
                self._create_relationships(relationships)

            logger.info("Graph data loaded successfully")
        except Exception as e:
            logger.error(f"Error loading graph data: {str(e)}")
            raise

    def _create_entities(self, entities: List[Dict[str, Any]]):
        """Create entity vertices in Neptune"""
        try:
            for entity in entities:
                # Create vertex with properties
                query = (
                    "g.addV('entity')"
                    f".property('name', '{entity['name']}')"
                    f".property('type', '{entity['type']}')"
                    f".property('description', '{entity['description']}')"
                )
                self.client.submit(query).all().result()
        except GremlinServerError as e:
            logger.error(f"Error creating entities: {str(e)}")
            raise

    def _create_relationships(self, relationships: List[Dict[str, Any]]):
        """Create relationship edges in Neptune"""
        try:
            for rel in relationships:
                # Find source and target vertices
                query = (
                    "g.V().has('entity', 'name', source)"
                    ".as('source')"
                    ".V().has('entity', 'name', target)"
                    ".as('target')"
                    ".addE('relates_to')"
                    ".property('description', description)"
                    ".property('strength', strength)"
                    ".property('keywords', keywords)"
                    ".from('source').to('target')"
                )
                
                bindings = {
                    'source': rel['source'],
                    'target': rel['target'],
                    'description': rel['description'],
                    'strength': float(rel['strength']),
                    'keywords': rel['keywords']
                }
                
                self.client.submit(query, bindings=bindings).all().result()
        except GremlinServerError as e:
            logger.error(f"Error creating relationships: {str(e)}")
            raise

    def get_graph_data(self) -> Dict[str, List]:
        """
        Get all graph data in a format suitable for visualization
        
        Returns:
            Dict containing nodes and edges lists
        """
        try:
            # Get all vertices
            vertices = self.client.submit(
                'g.V().project("id", "label", "properties")'
                '.by(id())'
                '.by(label())'
                '.by(valueMap())'
            ).all().result()

            # Get all edges
            edges = self.client.submit(
                'g.E().project("id", "label", "source", "target", "properties")'
                '.by(id())'
                '.by(label())'
                '.by(outV().id())'
                '.by(inV().id())'
                '.by(valueMap())'
            ).all().result()

            return {
                'nodes': vertices,
                'edges': edges
            }
        except GremlinServerError as e:
            logger.error(f"Error getting graph data: {str(e)}")
            raise

    def get_entity_neighbors(self, entity_name: str, depth: int = 1) -> Dict[str, List]:
        """
        Get entity and its neighbors up to specified depth
        
        Args:
            entity_name: Name of the entity to start from
            depth: How many hops to traverse (default 1)
            
        Returns:
            Dict containing nodes and edges for the subgraph
        """
        try:
            query = (
                f"g.V().has('entity', 'name', '{entity_name}')"
                f".repeat(both().simplePath()).times({depth})"
                ".path()"
                ".by(project('id', 'label', 'properties')"
                "   .by(id())"
                "   .by(label())"
                "   .by(valueMap()))"
            )
            
            paths = self.client.submit(query).all().result()
            
            # Process paths to extract unique nodes and edges
            nodes = set()
            edges = set()
            
            for path in paths:
                for i in range(len(path) - 1):
                    nodes.add(json.dumps(path[i]))
                    nodes.add(json.dumps(path[i + 1]))
                    
                    # Get edge between these nodes
                    edge_query = (
                        f"g.V({path[i]['id']})"
                        f".bothE().where(otherV().hasId({path[i + 1]['id']}))"
                        ".project('id', 'label', 'source', 'target', 'properties')"
                        ".by(id())"
                        ".by(label())"
                        ".by(outV().id())"
                        ".by(inV().id())"
                        ".by(valueMap())"
                    )
                    edge = self.client.submit(edge_query).next()
                    edges.add(json.dumps(edge))
            
            return {
                'nodes': [json.loads(n) for n in nodes],
                'edges': [json.loads(e) for e in edges]
            }
        except GremlinServerError as e:
            logger.error(f"Error getting entity neighbors: {str(e)}")
            raise

def init_neptune_graph(endpoint: str, context_dir: str):
    """
    Initialize Neptune graph with data from context directory
    
    Args:
        endpoint: Neptune cluster endpoint
        context_dir: Directory containing graph data files
    """
    try:
        manager = NeptuneGraphManager(endpoint)
        
        # Clear existing graph
        manager.clear_graph()
        
        # Load new data
        manager.load_graph_from_files(context_dir)
        
        logger.info("Neptune graph initialized successfully")
        return manager
    except Exception as e:
        logger.error(f"Error initializing Neptune graph: {str(e)}")
        raise 