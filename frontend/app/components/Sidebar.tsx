'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, X, MessageSquare, LayoutDashboard,
  Settings, Sparkles, Heart
} from 'lucide-react';
import { cn } from '@/lib/utils';

const menuItems = [
  {
    id: 'chat',
    label: 'チャット',
    sublabel: 'AIと対話',
    icon: MessageSquare,
    href: '/',
  },
  {
    id: 'dashboard',
    label: 'ダッシュボード',
    sublabel: '全データ一覧',
    icon: LayoutDashboard,
    href: '/dashboard',
  },
  {
    id: 'settings',
    label: '設定',
    sublabel: 'API連携',
    icon: Settings,
    href: '/settings',
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Menu Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-6 left-6 z-50 w-12 h-12 rounded-2xl bg-white border border-stone-200 shadow-md flex items-center justify-center md:hidden"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X size={22} className="text-stone-600" />
            </motion.div>
          ) : (
            <motion.div
              key="menu"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Menu size={22} className="text-stone-600" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ x: isOpen ? 0 : -280 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={cn(
          "w-[280px] h-screen fixed top-0 left-0 z-50",
          "flex flex-col p-6",
          "bg-white border-r border-stone-200",
          "md:translate-x-0"
        )}
      >
        {/* Logo */}
        <motion.div
          className="mb-10 px-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-200">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-stone-800">
                MIC
              </h1>
              <p className="text-[11px] text-stone-400">
                あなたのアシスタント
              </p>
            </div>
          </div>
        </motion.div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto -mx-2 px-2">
          <div className="flex flex-col gap-1">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * index }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "group flex items-center gap-4 px-4 py-3.5 rounded-xl",
                      "transition-all duration-200",
                      isActive
                        ? "bg-orange-50 border border-orange-200"
                        : "hover:bg-stone-50 border border-transparent"
                    )}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        "transition-all duration-200",
                        isActive
                          ? "bg-gradient-to-br from-orange-400 to-orange-500 shadow-lg shadow-orange-200"
                          : "bg-stone-100 group-hover:bg-stone-200"
                      )}
                    >
                      <Icon
                        size={18}
                        className={cn(
                          "transition-colors duration-200",
                          isActive
                            ? "text-white"
                            : "text-stone-500 group-hover:text-stone-700"
                        )}
                      />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div
                        className={cn(
                          "text-sm font-medium truncate",
                          "transition-colors duration-200",
                          isActive
                            ? "text-stone-800"
                            : "text-stone-600 group-hover:text-stone-800"
                        )}
                      >
                        {item.label}
                      </div>
                      <div
                        className={cn(
                          "text-[11px] truncate",
                          "transition-colors duration-200",
                          isActive
                            ? "text-orange-500"
                            : "text-stone-400 group-hover:text-stone-500"
                        )}
                      >
                        {item.sublabel}
                      </div>
                    </div>

                    {/* Active Indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="w-1 h-8 rounded-full bg-orange-500"
                        transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                      />
                    )}
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <motion.div
          className="pt-6 mt-auto border-t border-stone-200"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <div className="px-2 py-3 flex items-center justify-center gap-1.5">
            <span className="text-[11px] text-stone-400">v1.0</span>
            <Heart size={10} className="text-orange-400" />
          </div>
        </motion.div>
      </motion.aside>
    </>
  );
}
