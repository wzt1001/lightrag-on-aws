import React from 'react';
import { SideNavigation } from '@cloudscape-design/components';
import { useNavigate, useLocation } from 'react-router-dom';

function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <SideNavigation
      activeHref={location.pathname}
      header={{
        href: "/",
        text: "Navigation",
        onFollow: (event) => {
          event.preventDefault();
          navigate("/");
        }
      }}
      items={[
        { 
          type: "link", 
          text: "Upload", 
          href: "/",
          onFollow: (event) => {
            event.preventDefault();
            navigate("/");
          }
        },
        {
          type: "link",
          text: "Generated Contents",
          href: "/generated",
          onFollow: (event) => {
            event.preventDefault();
            navigate("/generated");
          }
        },
        { 
          type: "link", 
          text: "Visualize", 
          href: "/visualize",
          onFollow: (event) => {
            event.preventDefault();
            navigate("/visualize");
          }
        },
        { 
          type: "link", 
          text: "Chat", 
          href: "/chat",
          onFollow: (event) => {
            event.preventDefault();
            navigate("/chat");
          }
        }
      ]}
    />
  );
}

export default Navigation; 