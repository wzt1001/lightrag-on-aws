import React, { useState, useEffect } from 'react';
import {
  Container,
  Header,
  SpaceBetween,
  Box,
  Tabs,
  CodeEditor,
  Alert,
  Spinner
} from '@cloudscape-design/components';
import { API_BASE_URL } from '../config';
import ContextSelector from '../components/ContextSelector';
import { CodeEditorProps } from '@cloudscape-design/components';
import ace from 'ace-builds';
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/theme-monokai';

// Configure Ace
ace.config.set('basePath', '/node_modules/ace-builds/src-noconflict');

interface GeneratedFile {
  name: string;
  content: string;
}

function GeneratedContents() {
  const [selectedContext, setSelectedContext] = useState<string | null>(null);
  const [availableFiles, setAvailableFiles] = useState<string[]>([]);
  const [fileContents, setFileContents] = useState<Record<string, string>>({});
  const [loadingFile, setLoadingFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTabId, setActiveTabId] = useState("kv_store_full_docs.json");

  useEffect(() => {
    if (selectedContext) {
      fetchAvailableFiles();
    }
  }, [selectedContext]);

  const fetchAvailableFiles = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/generated_files/${selectedContext}`);
      if (!response.ok) {
        throw new Error('Failed to fetch file list');
      }
      const data = await response.json();
      setAvailableFiles(data.files);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setAvailableFiles([]);
    }
  };

  const fetchFileContent = async (filename: string) => {
    if (fileContents[filename]) return; // Don't fetch if already loaded

    setLoadingFile(filename);
    try {
      const response = await fetch(`${API_BASE_URL}/generated_files/${selectedContext}/${filename}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${filename}`);
      }
      const data = await response.json();
      setFileContents(prev => ({
        ...prev,
        [filename]: data.content
      }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoadingFile(null);
    }
  };

  const handleTabChange = ({ detail }: { detail: { activeTabId: string } }) => {
    setActiveTabId(detail.activeTabId);
    fetchFileContent(detail.activeTabId);
  };

  const editorPreferences: CodeEditorProps.Preferences = {
    theme: 'monokai',
    wrapLines: true
  };

  const getTabContent = (filename: string) => {
    if (loadingFile === filename) {
      return (
        <Box textAlign="center" padding="l">
          <Spinner size="large" />
          <Box variant="p" padding={{ top: 's' }}>
            Loading {filename}...
          </Box>
        </Box>
      );
    }

    const content = fileContents[filename] || '';
    let formattedContent = content;
    try {
      // Try to format JSON if it's valid
      if (content) {
        formattedContent = JSON.stringify(JSON.parse(content), null, 2);
      }
    } catch (e) {
      // If JSON parsing fails, use the original content
      console.warn('Failed to parse JSON:', e);
    }

    return (
      <Box padding="s">
        <CodeEditor
          ace={ace}
          value={formattedContent}
          language="json"
          preferences={editorPreferences}
          loading={false}
          readOnly
          onPreferencesChange={() => {}}
          i18nStrings={{
            loadingState: "Loading...",
            errorState: "There was an error loading the code editor.",
            errorStateRecovery: "Retry",
            editorGroupAriaLabel: "Code editor",
            statusBarGroupAriaLabel: "Status bar"
          }}
        />
      </Box>
    );
  };

  return (
    <Box padding="l">
      <SpaceBetween size="l">
        <ContextSelector onContextChange={setSelectedContext} />

        {error && (
          <Alert type="error">
            {error}
          </Alert>
        )}

        <Container
          header={
            <Header
              variant="h1"
              description="View the generated JSON files from processed content"
              counter={!selectedContext ? "(Select a context first)" : undefined}
            >
              Generated Contents
            </Header>
          }
        >
          <Box color={!selectedContext ? "text-status-inactive" : undefined}>
            <Tabs
              activeTabId={activeTabId}
              onChange={handleTabChange}
              tabs={[
                {
                  id: "kv_store_full_docs.json",
                  label: "Full Documents",
                  content: getTabContent("kv_store_full_docs.json")
                },
                {
                  id: "kv_store_text_chunks.json",
                  label: "Text Chunks",
                  content: getTabContent("kv_store_text_chunks.json")
                },
                {
                  id: "kv_store_llm_response_cache.json",
                  label: "LLM Response Cache",
                  content: getTabContent("kv_store_llm_response_cache.json")
                },
                {
                  id: "vdb_chunks.json",
                  label: "Vector DB Chunks",
                  content: getTabContent("vdb_chunks.json")
                },
                {
                  id: "vdb_entities.json",
                  label: "Vector DB Entities",
                  content: getTabContent("vdb_entities.json")
                },
                {
                  id: "vdb_relationships.json",
                  label: "Vector DB Relationships",
                  content: getTabContent("vdb_relationships.json")
                }
              ]}
            />
          </Box>
        </Container>
      </SpaceBetween>
    </Box>
  );
}

export default GeneratedContents; 