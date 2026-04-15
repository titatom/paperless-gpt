import {
  mdiCogOutline,
  mdiFileChartOutline,
  mdiHistory,
  mdiHomeOutline,
  mdiTextBoxSearchOutline,
} from "@mdi/js";
import { Icon } from "@mdi/react";
import axios from "axios";
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import logo from "../assets/logo.svg";
import "./Sidebar.css";

interface SidebarProps {
  onSelectPage: (page: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onSelectPage }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [ocrEnabled, setOcrEnabled] = useState(false);
  const location = useLocation();

  const toggleSidebar = () => {
    setCollapsed((prev) => !prev);
  };

  const handlePageClick = (page: string) => {
    onSelectPage(page);
  };

  useEffect(() => {
    let isMounted = true;

    const fetchOcrEnabled = async () => {
      try {
        const res = await axios.get<{ enabled: boolean }>(
          "./api/experimental/ocr"
        );
        if (isMounted) {
          setOcrEnabled(res.data.enabled);
        }
      } catch (err) {
        console.error(err);
      }
    };

    void fetchOcrEnabled();

    return () => {
      isMounted = false;
    };
  }, []);

  const menuItems = [
    { name: "home", path: "./", icon: mdiHomeOutline, title: "Home" },
    {
      name: "adhoc-analysis",
      path: "./adhoc-analysis",
      icon: mdiFileChartOutline,
      title: "Ad-hoc Analysis",
    },
    { name: "history", path: "./history", icon: mdiHistory, title: "History" },
    { name: "settings", path: "./settings", icon: mdiCogOutline, title: "Settings" },
  ];

  // If OCR is enabled, add the OCR menu item
  if (ocrEnabled) {
    menuItems.push({
      name: "ocr",
      path: "./experimental-ocr",
      icon: mdiTextBoxSearchOutline,
      title: "OCR",
    });
  }

  return (
    <aside
      className={`sidebar ${collapsed ? "collapsed" : ""}`}
      aria-label="Primary navigation"
    >
      <div className={`sidebar-header ${collapsed ? "collapsed" : ""}`}>
        {!collapsed && (
          <div className="sidebar-brand">
            <img
              src={logo}
              alt="Paperless GPT logo"
              className="logo w-8 h-8 object-contain flex-shrink-0"
            />
            <div className="sidebar-brand-copy">
              <span className="sidebar-brand-title">Paperless GPT</span>
              <span className="sidebar-brand-subtitle">Document workflows</span>
            </div>
          </div>
        )}
        <button
          className="toggle-btn"
          onClick={toggleSidebar}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          type="button"
        >
          &#9776;
        </button>
      </div>
      <nav className="sidebar-nav" aria-label="App sections">
        <ul className="menu-items">
        {menuItems.map((item) => (
          <li key={item.name}>
            <Link
              to={item.path}
              onClick={() => handlePageClick(item.name)}
              className={
                location.pathname.split("/").at(-1) === item.path.split("/").at(-1)
                  ? "menu-link active"
                  : "menu-link"
              }
              aria-current={
                location.pathname.split("/").at(-1) === item.path.split("/").at(-1)
                  ? "page"
                  : undefined
              }
              title={collapsed ? item.title : undefined}
            >
              <div className="menu-icon">
                <Icon path={item.icon} size={1} />
              </div>
              {!collapsed && <span className="menu-label">{item.title}</span>}
            </Link>
          </li>
        ))}
        </ul>
      </nav>
    </aside>
  );
};

export default Sidebar;
