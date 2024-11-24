import React, { useState } from 'react';
import {
  Container,
  Header,
  SpaceBetween,
  FormField,
  Input,
  Button,
  Tabs,
  Box,
  Alert,
  Cards,
  Icon,
} from '@cloudscape-design/components';
import { API_BASE_URL } from '../config';
import ContextSelector from '../components/ContextSelector';

interface QueryResponse {
  naive: string;
  local: string;
  global_: string;
  hybrid: string;
}

interface TabDefinition {
  id: keyof QueryResponse;
  label: string;
  icon: string;
  description: string;
}

function Chat() {
  const [query, setQuery] = useState('');
  const [responses, setResponses] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<keyof QueryResponse>("hybrid");
  const [selectedContext, setSelectedContext] = useState<string | null>(null);

  const tabDefinitions: TabDefinition[] = [
    {
      id: "hybrid",
      label: "Hybrid",
      icon: "share",
      description: "Combined Analysis"
    },
    {
      id: "local",
      label: "Local",
      icon: "folder",
      description: "Entity-Focused Analysis"
    },
    {
      id: "global_",
      label: "Global",
      icon: "status-positive",
      description: "Relationship-Based Analysis"
    },
    {
      id: "naive",
      label: "Naive",
      icon: "search",
      description: "Basic Analysis"
    }
  ];

  const handleSubmit = async () => {
    if (!query.trim() || !selectedContext) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/query?context_id=${selectedContext}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await response.json();
      if (data.status === 'success') {
        setResponses(data.data);
      } else {
        throw new Error(data.message || 'Failed to get response');
      }
    } catch (error) {
      console.error('Error querying:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while processing your request');
      setResponses(null);
    }
    setLoading(false);
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <Box padding="l">
      <SpaceBetween size="l">
        <ContextSelector onContextChange={setSelectedContext} />
        
        <Container
          header={
            <Header
              variant="h1"
              description="Ask questions about your uploaded content"
              counter={!selectedContext ? "(Select a context first)" : undefined}
              actions={
                <Button
                  variant="primary"
                  loading={loading}
                  onClick={handleSubmit}
                  disabled={!selectedContext || !query.trim()}
                  iconName="search"
                >
                  Ask
                </Button>
              }
            >
              <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                <Icon name="comments" />
                Interactive Chat
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

            <SpaceBetween size="l">
              <FormField 
                label={
                  <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                    <Icon name="search" />
                    Your question
                  </SpaceBetween>
                }
              >
                <Input
                  value={query}
                  onChange={({ detail }) => setQuery(detail.value)}
                  placeholder={selectedContext ? "Type your question..." : "Select a context first"}
                  type="text"
                  onKeyPress={handleKeyPress}
                  disabled={!selectedContext}
                />
              </FormField>

              {responses && (
                <Container>
                  <Tabs
                    activeTabId={selectedTab}
                    onChange={({ detail }) => setSelectedTab(detail.activeTabId as keyof QueryResponse)}
                    tabs={tabDefinitions.map(tab => ({
                      id: tab.id,
                      label: (
                        <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                          <Icon name={tab.icon} />
                          {tab.label}
                        </SpaceBetween>
                      ),
                      content: (
                        <Box padding="l">
                          <Cards
                            cardDefinition={{
                              header: () => (
                                <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                                  <Icon name={tab.icon} />
                                  {tab.description}
                                </SpaceBetween>
                              ),
                              sections: [
                                {
                                  id: "content",
                                  content: () => responses[tab.id]
                                }
                              ]
                            }}
                            items={[{}]}
                          />
                        </Box>
                      )
                    }))}
                  />
                </Container>
              )}
            </SpaceBetween>
          </Box>
        </Container>
      </SpaceBetween>
    </Box>
  );
}

export default Chat; 