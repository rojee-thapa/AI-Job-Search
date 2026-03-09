'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, Briefcase, CheckSquare,
  Mail, Mic, Settings, LogOut, Bot, ChevronRight, Star,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { logout } from '../../lib/auth';

const NAV = [
  { href: '/dashboard',      label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/resume',         label: 'Resume',          icon: FileText         },
  { href: '/jobs',           label: 'Jobs',            icon: Briefcase        },
  { href: '/saved',          label: 'Saved Jobs',      icon: Star             },
  { href: '/applications',   label: 'Applications',    icon: CheckSquare      },
  { href: '/email',          label: 'Outreach',        icon: Mail             },
  { href: '/interview-prep', label: 'Interview Prep',  icon: Mic              },
  { href: '/settings',       label: 'Settings',        icon: Settings         },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-60 bg-gray-900 flex flex-col">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">AI Job Agent</p>
            <p className="text-gray-400 text-xs">Auto-applying for you</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                active
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/30'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800',
              )}
            >
              <Icon size={18} className="flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} className="opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-gray-800">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-gray-800 transition-all"
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
