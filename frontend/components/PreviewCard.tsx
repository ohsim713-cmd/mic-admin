'use client';

import React from 'react';

interface PreviewCardProps {
    content: string;
    onPostX?: () => void;
    onPostN8N?: () => void;
}

export default function PreviewCard({ content, onPostX, onPostN8N }: PreviewCardProps) {
    if (!content) return null;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 border border-gray-200 dark:border-gray-700 max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center space-x-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-tr from-blue-500 to-cyan-400 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
                    AI
                </div>
                <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">SNS Agent</h3>
                    <p className="text-gray-500 text-sm dark:text-gray-400">@sns_auto_gen</p>
                </div>
            </div>

            <div className="text-gray-800 dark:text-gray-200 text-lg leading-relaxed whitespace-pre-wrap mb-6">
                {content}
            </div>

            <div className="flex flex-col space-y-3">
                <button
                    onClick={onPostX}
                    className="w-full py-3 px-4 bg-black hover:bg-gray-900 text-white rounded-lg font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md flex items-center justify-center space-x-2"
                >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                    </svg>
                    <span>Xに直接投稿 (API連携待ち)</span>
                </button>

                <button
                    onClick={onPostN8N}
                    className="w-full py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md border-b-4 border-orange-700"
                >
                    n8n Webhookに送信
                </button>
            </div>
        </div>
    );
}
