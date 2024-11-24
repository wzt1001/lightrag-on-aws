import { SideNavigation } from '@cloudscape-design/components';

// ... other imports ...

const navigationItems = [
  { type: "link", text: "Home", href: "/" },
  { type: "link", text: "Upload", href: "/upload" },
  { type: "link", text: "Generated Contents", href: "/generated" },
  { type: "link", text: "Visualize", href: "/visualize" },
  // ... any other navigation items ...
] as const;

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="nav">
        <SideNavigation
          activeHref={window.location.pathname}
          items={navigationItems}
          header={{ text: 'LightRAG', href: '/' }}
        />
      </div>
      <div className="content">
        {children}
      </div>
    </div>
  );
}

export default Layout; 