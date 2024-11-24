import React, { useState, useEffect } from 'react';
import {
  Container,
  Header,
  SpaceBetween,
  FormField,
  Textarea,
  Button,
  Alert,
  Box,
  Icon,
  ColumnLayout,
  ProgressBar,
  Select,
  SelectProps,
  Input,
  Multiselect,
  MultiselectProps,
  Tabs,
} from '@cloudscape-design/components';
import { API_BASE_URL } from '../config';
import ContextSelector from '../components/ContextSelector';

type IconName = 
  | "edit" 
  | "file" 
  | "upload" 
  | "status-info" 
  | "folder"
  | "remove";

interface UploadProgress {
  total: number;
  completed: number;
  currentFile: string;
}

interface PromptVariable {
  name: string;
  type: 'string' | 'array' | 'object';
  currentValue: string | string[];
}

interface Tag {
  label: string;
  key?: string;
  value?: string;
  existing?: boolean;
}

interface I18nStrings {
  keysSuggestion: string;
  removeTags?: string;
  tags: string;
}

function Upload() {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [selectedVariable, setSelectedVariable] = useState<SelectProps.Option | null>(null);
  const [variableValue, setVariableValue] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [variableOptions, setVariableOptions] = useState<PromptVariable[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [selectedContext, setSelectedContext] = useState<string | null>(null);
  const [selectedUploadTab, setSelectedUploadTab] = useState('text');

  useEffect(() => {
    if (selectedContext) {
      fetchVariables();
    }
  }, [selectedContext]);

  const fetchVariables = async () => {
    if (!selectedContext) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/get_prompt_variables?context_id=${selectedContext}`);
      const data = await response.json();
      setVariableOptions(data.variables);
    } catch (error) {
      setMessage('Error loading prompt variables');
      setIsError(true);
    }
  };

  const selectOptions: SelectProps.Option[] = variableOptions.map(opt => ({
    label: opt.name,
    value: opt.name,
    description: `Type: ${opt.type}`
  }));

  useEffect(() => {
    if (selectedVariable) {
      const variable = variableOptions.find(v => v.name === selectedVariable.value);
      if (variable) {
        if (variable.type === 'array') {
          setTags(variable.currentValue as string[]);
          setVariableValue('');
        } else {
          setVariableValue(variable.currentValue as string);
          setTags([]);
        }
      }
    }
  }, [selectedVariable]);

  const handleVariableChange = async () => {
    if (!selectedContext || !selectedVariable) return;
    
    const variable = variableOptions.find(v => v.name === selectedVariable.value);
    if (!variable) return;

    try {
      const response = await fetch(`${API_BASE_URL}/update_prompt?context_id=${selectedContext}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          variable: selectedVariable.value, 
          value: variable.type === 'array' ? tags : variableValue,
          type: variable.type
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update variable');
      }
      
      const data = await response.json();
      setMessage(data.message);
      setIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error updating variable');
      setIsError(true);
    }
  };

  const handleTextUpload = async () => {
    if (!text.trim() || !selectedContext) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/insert?context_id=${selectedContext}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      setMessage(data.message);
      setIsError(false);
      setText('');
    } catch (error) {
      setMessage('Error uploading text');
      setIsError(true);
    }
    setLoading(false);
  };

  const handleFileUpload = async () => {
    if (!files || files.length === 0 || !selectedContext) return;
    setLoading(true);
    setUploadProgress({
      total: files.length,
      completed: 0,
      currentFile: files[0].name
    });

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        setUploadProgress(prev => ({
          total: prev?.total || files.length,
          completed: i,
          currentFile: file.name
        }));

        const response = await fetch(`${API_BASE_URL}/insert_file?context_id=${selectedContext}`, {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}: ${data.detail}`);
        }
      }

      setMessage(`Successfully uploaded ${files.length} files`);
      setIsError(false);
      setFiles(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error uploading files');
      setIsError(true);
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  };

  const handleClear = async () => {
    if (!selectedContext) return;
    setClearLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/contexts/${selectedContext}/clear`, {
        method: 'DELETE',
      });
      const data = await response.json();
      setMessage(data.message);
      setIsError(false);
      setText('');
      setFiles(null);
    } catch (error) {
      setMessage('Error clearing data');
      setIsError(true);
    }
    setClearLoading(false);
  };

  const handleAddTag = (newTag: string) => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
    }
    setNewTagInput('');
  };

  return (
    <div className="page-content">
      <Box padding="l">
        <SpaceBetween size="l">
          <ContextSelector onContextChange={setSelectedContext} />

          {/* Prompt Editing Section */}
          <Box>
            <Header
              variant="h1"
              description="Edit prompt variables and their values"
              counter={!selectedContext ? "(Select a context first)" : undefined}
            >
              Prompt Editing
            </Header>

            <Box color={!selectedContext ? "text-status-inactive" : undefined}>
              {message && (
                <Alert type={isError ? "error" : "success"}>
                  {message}
                </Alert>
              )}

              <SpaceBetween size="l">
                <FormField label="Select Variable to Edit">
                  <Select
                    options={selectOptions}
                    selectedOption={selectedVariable}
                    onChange={({ detail }) => setSelectedVariable(detail.selectedOption)}
                    placeholder="Choose a variable"
                    expandToViewport
                    disabled={!selectedContext}
                  />
                </FormField>
                
                {selectedVariable && variableOptions.find(v => v.name === selectedVariable.value)?.type === 'array' ? (
                  <FormField label="Edit Tags" stretch>
                    <SpaceBetween size="xs">
                      <Box padding="s">
                        <SpaceBetween direction="horizontal" size="xxs" alignItems="center">
                          {tags.map((tag, index) => (
                            <Box
                              padding="xs"
                              color="text-status-info"  // Changed from "background.blue.100"
                              display="inline-block"
                              margin="xxxs"
                            >
                              <SpaceBetween direction="horizontal" size="xxs" alignItems="center">
                                <Box fontSize="body-s" fontWeight="bold">
                                  {tag}
                                </Box>
                                <Button
                                  variant="inline-icon"
                                  iconName="close"
                                  onClick={() => setTags(tags.filter((_, i) => i !== index))}
                                  formAction="none"
                                  ariaLabel={`Remove ${tag}`}
                                />
                              </SpaceBetween>
                            </Box>
                          ))}
                        </SpaceBetween>
                      </Box>
                      <SpaceBetween direction="horizontal" size="xs">
                        <Input
                          value={newTagInput}
                          onChange={({ detail }) => setNewTagInput(detail.value)}
                          placeholder="Type new tag"
                          onKeyDown={({ detail }) => {
                            if (detail.key === 'Enter' && newTagInput.trim()) {
                              handleAddTag(newTagInput);
                            }
                          }}
                        />
                        <Button
                          onClick={() => handleAddTag(newTagInput)}
                          disabled={!newTagInput.trim()}
                          variant="primary"
                        >
                          Add Tag
                        </Button>
                      </SpaceBetween>
                      <Box color="text-body-secondary" fontSize="body-s" padding={{ bottom: 's' }}>
                        Press Enter or click Add Tag to add a new tag
                      </Box>
                    </SpaceBetween>
                  </FormField>
                ) : (
                  <FormField label="New Value" stretch>
                    <Textarea
                      value={variableValue}
                      onChange={({ detail }) => setVariableValue(detail.value)}
                      placeholder="Enter new value"
                      rows={20}
                    />
                  </FormField>
                )}
                
                <Button
                  variant="primary"
                  onClick={handleVariableChange}
                  disabled={
                    !selectedContext ||
                    !selectedVariable || 
                    (variableOptions.find(v => v.name === selectedVariable.value)?.type === 'array' 
                      ? tags.length === 0 
                      : !variableValue.trim())
                  }
                >
                  Update Variable
                </Button>
              </SpaceBetween>
            </Box>
          </Box>

          {/* Content Upload Section */}
          <Box padding={{ top: 'xl' }}>
            <Container
              header={
                <Header
                  variant="h1"
                  description="Upload your content through text input or file upload"
                  counter={!selectedContext ? "(Select a context first)" : undefined}
                  actions={
                    <Button
                      variant="normal"
                      loading={clearLoading}
                      onClick={handleClear}
                      iconName="remove"
                      disabled={!selectedContext}
                    >
                      Clear All Data
                    </Button>
                  }
                >
                  Content Upload
                </Header>
              }
            >
              <Box color={!selectedContext ? "text-status-inactive" : undefined}>
                {uploadProgress && (
                  <Box padding={{ bottom: 'l' }}>
                    <SpaceBetween size="m">
                      <Box variant="p">
                        Processing: {uploadProgress.currentFile} ({uploadProgress.completed + 1}/{uploadProgress.total})
                      </Box>
                      <ProgressBar
                        value={((uploadProgress.completed + 1) / uploadProgress.total) * 100}
                        label="Upload progress"
                        description={`${uploadProgress.completed + 1} of ${uploadProgress.total} files processed`}
                      />
                    </SpaceBetween>
                  </Box>
                )}

                <Tabs
                  activeTabId={selectedUploadTab}
                  onChange={({ detail }) => setSelectedUploadTab(detail.activeTabId)}
                  tabs={[
                    {
                      id: "text",
                      label: (
                        <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                          <Icon name="edit" />
                          Text Upload
                        </SpaceBetween>
                      ),
                      content: (
                        <Container>
                          <FormField
                            label="Enter your text"
                            description="Type or paste your text content here"
                            stretch
                          >
                            <Textarea
                              value={text}
                              onChange={({ detail }) => setText(detail.value)}
                              placeholder="Enter text to upload..."
                              rows={10}
                              disabled={!selectedContext}
                            />
                          </FormField>
                          <Box textAlign="right" padding={{ top: 'l' }}>
                            <Button
                              variant="primary"
                              loading={loading}
                              onClick={handleTextUpload}
                              disabled={!selectedContext || !text.trim()}
                              iconName="upload"
                            >
                              Upload Text
                            </Button>
                          </Box>
                        </Container>
                      )
                    },
                    {
                      id: "file",
                      label: (
                        <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                          <Icon name="folder" />
                          File Upload
                        </SpaceBetween>
                      ),
                      content: (
                        <Container>
                          <FormField
                            label="Choose files"
                            description="Supported formats: TXT, PDF, DOC, DOCX"
                            stretch
                          >
                            <Box 
                              padding="s"
                              className="dropzone"
                              color={!selectedContext ? "text-status-inactive" : undefined}
                            >
                              <input
                                type="file"
                                onChange={(e) => setFiles(e.target.files)}
                                accept=".txt,.pdf,.doc,.docx"
                                multiple
                                disabled={!selectedContext}
                                style={{ 
                                  width: '100%',
                                  height: '100%',
                                  opacity: 0,
                                  position: 'absolute',
                                  cursor: selectedContext ? 'pointer' : 'not-allowed'
                                }}
                              />
                              <Box textAlign="center" color="text-body-secondary">
                                <Icon name="upload" size="big" />
                                <Box variant="p" padding={{ top: 's' }}>
                                  {selectedContext 
                                    ? "Drag and drop files here, or click to select files"
                                    : "Select a context first to upload files"
                                  }
                                </Box>
                                {files && files.length > 0 && (
                                  <Box variant="p" padding={{ top: 's' }} color="text-status-success">
                                    Selected: {files.length} file{files.length !== 1 ? 's' : ''}
                                    <Box variant="small" padding={{ top: 'xs' }}>
                                      {Array.from(files).map(file => (
                                        <div key={file.name}>{file.name}</div>
                                      ))}
                                    </Box>
                                  </Box>
                                )}
                              </Box>
                            </Box>
                          </FormField>
                          <Box textAlign="right" padding={{ top: 'l' }}>
                            <Button
                              variant="primary"
                              loading={loading}
                              onClick={handleFileUpload}
                              disabled={!selectedContext || !files || files.length === 0}
                              iconName="upload"
                            >
                              Upload Files
                            </Button>
                          </Box>
                        </Container>
                      )
                    }
                  ]}
                />
              </Box>
            </Container>
          </Box>
        </SpaceBetween>
      </Box>
    </div>
  );
}

export default Upload;