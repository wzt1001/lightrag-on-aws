import React from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';
import { AppLayout, TopNavigation } from '@cloudscape-design/components';
import Upload from './pages/Upload';
import Chat from './pages/Chat';
import Navigation from './components/Navigation';
import Visualize from './pages/Visualize';
import GeneratedContents from './pages/GeneratedContents';

function AppContent() {
  const navigate = useNavigate();

  return (
    <div>
      <TopNavigation
        identity={{
          href: "/",
          title: "Guidance for RAG using Graph Demo",
          onFollow: (event) => {
            event.preventDefault();
            navigate("/");
          }
        }}
        utilities={[]}
      />
      <AppLayout
        navigation={<Navigation />}
        content={
          <Routes>
            <Route path="/" element={<Upload />} />
            <Route path="/visualize" element={<Visualize />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/generated" element={<GeneratedContents />} />
          </Routes>
        }
        toolsHide={true}
      />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App; 