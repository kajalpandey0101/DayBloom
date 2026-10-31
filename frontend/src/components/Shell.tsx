import { NavLink, Outlet } from "react-router-dom";
import { Flower2, LogOut, Settings, Sprout } from "lucide-react";
import type { LoginUser } from "../types";

interface Props {
  user: LoginUser;
  onLogout: () => Promise<void>;
}

export default function Shell({ user, onLogout }: Props) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink className="brand" to="/daily-checkin" aria-label="DayBloom home">
          <span className="brand-mark"><Flower2 size={22} strokeWidth={1.8} /></span>
          <span>DayBloom</span>
        </NavLink>
        <div className="nav-label">YOUR SPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          <NavLink to="/daily-checkin" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            <Sprout size={18} /> <span>Daily Check-in</span>
          </NavLink>
          <NavLink to="/streaks" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            <Flower2 size={18} /> <span>My Streaks</span>
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}>
            <Settings size={18} /> <span>Settings</span>
          </NavLink>
          <div className="profile-card">
            <div className="avatar">{user.username.slice(0, 1).toUpperCase()}</div>
            <div className="profile-copy"><strong>{user.username}</strong><span>Your private garden</span></div>
          </div>
          <button className="logout-button" onClick={() => void onLogout()}><LogOut size={16} /> Sign out</button>
        </div>
      </aside>
      <div className="main-column">
        <header className="mobile-header">
          <NavLink className="brand" to="/daily-checkin"><span className="brand-mark"><Flower2 size={20} /></span>DayBloom</NavLink>
          <button className="mobile-logout" aria-label="Sign out" onClick={() => void onLogout()}><LogOut size={17} /></button>
        </header>
        <main className="page-content"><Outlet /></main>
        <nav className="mobile-nav" aria-label="Main navigation">
          <NavLink to="/daily-checkin" className={({ isActive }) => `mobile-nav-link ${isActive ? "active" : ""}`}>
            <Sprout size={19} /><span>Check-in</span>
          </NavLink>
          <NavLink to="/streaks" className={({ isActive }) => `mobile-nav-link ${isActive ? "active" : ""}`}>
            <Flower2 size={19} /><span>My Streaks</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `mobile-nav-link ${isActive ? "active" : ""}`}>
            <Settings size={19} /><span>Settings</span>
          </NavLink>
        </nav>
      </div>
    </div>
  );
}
