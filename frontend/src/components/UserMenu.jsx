import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import { labelFor, ROLES } from '../constants.js'
import './UserMenu.css'

// Signed-in username and picture, top right of every page after login.
export default function UserMenu({ user, onSignOut }) {
  const [open, setOpen] = useState(false)
  const [pictureFailed, setPictureFailed] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (event.type === 'keydown' ? event.key === 'Escape' : !menuRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        type="button"
        className="user-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Account menu"
        onClick={() => setOpen((value) => !value)}
      >
        {user.picture && !pictureFailed ? (
          <img className="user-menu__avatar" src={user.picture} alt="" onError={() => setPictureFailed(true)} />
        ) : (
          <span className="user-menu__avatar" aria-hidden="true">
            {user.username.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="user-menu__name">{user.username}</span>
        <ChevronDown className="user-menu__caret" size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="user-menu__dropdown" role="menu">
          <p className="user-menu__role">{labelFor(ROLES, user.role)}</p>
          <button type="button" role="menuitem" className="user-menu__item" title="Sign out of Limitless" onClick={onSignOut}>
            <LogOut size={16} aria-hidden="true" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}
