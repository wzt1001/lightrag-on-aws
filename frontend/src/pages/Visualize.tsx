import React, { useState, useEffect } from 'react';
import {
  Container,
  Header,
  SpaceBetween,
  Box,
  Alert,
  Icon,
  Spinner,
  Button,
} from '@cloudscape-design/components';
import { API_BASE_URL } from '../config';
import ContextSelector from '../components/ContextSelector';

function Visualize() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [graphUrl, setGraphUrl] = useState<string | null>(null);
  const [selectedContext, setSelectedContext] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const loadGraph = async (forceRegenerate: boolean = false) => {
    if (!selectedContext) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/visualize?context_id=${selectedContext}&regenerate=${forceRegenerate}`
      );
      if (!response.ok) {
        throw new Error('Failed to generate graph visualization');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setGraphUrl(url);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
    }
    setLoading(false);
    setRegenerating(false);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    await loadGraph(true);
  };

  useEffect(() => {
    if (selectedContext) {
      loadGraph(false);
    } else {
      setGraphUrl(null);
    }
    return () => {
      if (graphUrl) {
        URL.revokeObjectURL(graphUrl);
      }
    };
  }, [selectedContext]);

  return (
    <Box padding="l">
      <SpaceBetween size="l">
        <ContextSelector onContextChange={setSelectedContext} />
        
        <Container
          header={
            <Header
              variant="h1"
              description="Visualization of the knowledge graph"
              counter={!selectedContext ? "(Select a context first)" : undefined}
              actions={
                <Button
                  iconName="refresh"
                  loading={regenerating}
                  disabled={!selectedContext || loading}
                  onClick={handleRegenerate}
                >
                  Regenerate Graph
                </Button>
              }
            >
              <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                Knowledge Graph
              </SpaceBetween>
            </Header>
          }
        >
          <Box color={!selectedContext ? "text-status-inactive" : undefined}>
            {error && (
              <Alert type="error">
                {error}
              </Alert>
            )}

            <Box textAlign="center">
              {!selectedContext ? (
                <Box variant="p" color="text-status-inactive">
                  Please select a context to view its knowledge graph
                </Box>
              ) : loading ? (
                <SpaceBetween size="m" direction="vertical" alignItems="center">
                  <Spinner size="large" />
                  <Box variant="p">
                    {regenerating ? 'Regenerating graph visualization...' : 'Loading graph visualization...'}
                  </Box>
                </SpaceBetween>
              ) : graphUrl ? (
                <iframe
                  src={graphUrl}
                  style={{
                    width: '100%',
                    height: '80vh',
                    border: 'none',
                    borderRadius: '4px',
                    backgroundColor: '#ffffff'
                  }}
                  title="Knowledge Graph Visualization"
                />
              ) : null}
            </Box>
          </Box>
        </Container>
      </SpaceBetween>
    </Box>
  );
}

export default Visualize; 