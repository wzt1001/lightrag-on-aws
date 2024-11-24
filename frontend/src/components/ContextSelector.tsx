import React, { useState, useEffect } from 'react';
import {
  Select,
  Button,
  Modal,
  FormField,
  Input,
  SpaceBetween,
  TextContent,
} from '@cloudscape-design/components';
import { API_BASE_URL } from '../config';

interface Context {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

interface ContextSelectorProps {
  onContextChange: (contextId: string | null) => void;
}

function ContextSelector({ onContextChange }: ContextSelectorProps) {
  const [contexts, setContexts] = useState<Context[]>([]);
  const [selectedContext, setSelectedContext] = useState<string | null>(null);
  const [isCreateModalVisible, setCreateModalVisible] = useState(false);
  const [newContextName, setNewContextName] = useState('');
  const [newContextDescription, setNewContextDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadContexts();
  }, []);

  const loadContexts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/contexts`);
      const data = await response.json();
      setContexts(data.contexts);
    } catch (error) {
      console.error('Failed to load contexts:', error);
    }
  };

  const handleCreateContext = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/contexts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newContextName,
          description: newContextDescription
        }),
      });
      const newContext = await response.json();
      setContexts([...contexts, newContext]);
      setCreateModalVisible(false);
      setNewContextName('');
      setNewContextDescription('');
    } catch (error) {
      console.error('Failed to create context:', error);
    }
    setLoading(false);
  };

  const handleDeleteContext = async () => {
    if (!selectedContext) return;
    
    if (!window.confirm('Are you sure you want to delete this context? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/contexts/${selectedContext}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete context');
      }
      
      setContexts(contexts.filter(c => c.id !== selectedContext));
      setSelectedContext(null);
      onContextChange(null);
    } catch (error) {
      console.error('Failed to delete context:', error);
    }
  };

  return (
    <SpaceBetween size="m">
      <FormField label="Select Context">
        <SpaceBetween direction="horizontal" size="xs">
          <Select
            selectedOption={
              selectedContext
                ? {
                    label: contexts.find(c => c.id === selectedContext)?.name || '',
                    value: selectedContext
                  }
                : null
            }
            onChange={({ detail }) => {
              setSelectedContext(detail.selectedOption?.value || null);
              onContextChange(detail.selectedOption?.value || null);
            }}
            options={contexts.map(context => ({
              label: context.name,
              value: context.id,
              description: context.description
            }))}
            placeholder="Choose a context"
          />
          <Button onClick={() => setCreateModalVisible(true)}>
            Create New Context
          </Button>
          {selectedContext && (
            <Button
              onClick={handleDeleteContext}
              variant="primary"
              formAction="none"
              iconName="remove"
              // Add red color styling
              className="delete-button"
            >
              Delete Context
            </Button>
          )}
        </SpaceBetween>
      </FormField>

      <Modal
        visible={isCreateModalVisible}
        onDismiss={() => setCreateModalVisible(false)}
        header="Create New Context"
      >
        <SpaceBetween size="m">
          <FormField label="Name">
            <Input
              value={newContextName}
              onChange={({ detail }) => setNewContextName(detail.value)}
            />
          </FormField>
          <FormField label="Description">
            <Input
              value={newContextDescription}
              onChange={({ detail }) => setNewContextDescription(detail.value)}
            />
          </FormField>
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={() => setCreateModalVisible(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleCreateContext}
              loading={loading}
              disabled={!newContextName.trim()}
            >
              Create
            </Button>
          </SpaceBetween>
        </SpaceBetween>
      </Modal>

      <style>
        {`
          .delete-button {
            background-color: #d13212 !important;
            border-color: #d13212 !important;
            color: white !important;
          }
          .delete-button:hover {
            background-color: #de350b !important;
            border-color: #de350b !important;
          }
        `}
      </style>
    </SpaceBetween>
  );
}

export default ContextSelector; 