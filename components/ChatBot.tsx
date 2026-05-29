/**
 * ChatBot Component v2.0
 * Persistent chat with database-backed conversations
 * Always-on RAG with source attribution
 */

import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Bot, User, Minimize2, Loader2, BookOpen, Lightbulb } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, ChatCitation } from '../types';
import { API_BASE_URL } from '../services/apiConfig';

interface ChatBotProps {
  reportContext?: any;
  isOpen: boolean;
  onClose: () => void;
}

const INITIAL_MESSAGE: ChatMessage = {
  role: 'model',
  text: 'Hola, soy SeguroBot AI. Puedo responder preguntas sobre las cotizaciones analizadas y los clausulados. ¿En qué puedo ayudarte?',
  timestamp: new Date()
};

const ChatBot: React.FC<ChatBotProps> = ({ reportContext, isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Load thread when report context changes or chat opens
  useEffect(() => {
    if (isOpen && reportContext?.id) {
      loadThread(reportContext.id);
      loadSuggestions();
    }
  }, [isOpen, reportContext?.id]);

  // Reset chat when report context changes
  useEffect(() => {
    if (reportContext?.id) {
      setMessages([INITIAL_MESSAGE]);
      setThreadId(null);
      setShowSuggestions(true);
    }
  }, [reportContext?.id]);

  const loadThread = async (reportId: string) => {
    try {
      const user = localStorage.getItem('seguro_app_user');
      const userId = user ? JSON.parse(user)?.id : 'anonymous';
      
      const response = await fetch(`${API_BASE_URL}/chat/threads/report/${reportId}?userId=${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        setThreadId(data.threadId);
        
        // Load existing messages if any
        if (data.messages && data.messages.length > 0) {
          const loadedMessages: ChatMessage[] = data.messages.map((msg: any) => ({
            role: msg.role,
            text: msg.text,
            timestamp: new Date(msg.createdAt),
            citations: msg.citations,
            source: msg.sourcesUsed?.[0]?.type || 'direct'
          }));
          setMessages(loadedMessages);
          setShowSuggestions(false);
        }
      }
    } catch (error) {
      console.error('Failed to load thread:', error);
    }
  };

  const loadSuggestions = async () => {
    if (!reportContext) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/chat/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportContext })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, suggestedMessage?: string) => {
    e?.preventDefault();
    const messageText = suggestedMessage || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: ChatMessage = { 
      role: 'user', 
      text: messageText, 
      timestamp: new Date() 
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setShowSuggestions(false);

    try {
      const user = localStorage.getItem('seguro_app_user');
      const userId = user ? JSON.parse(user)?.id : 'anonymous';
      
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: messageText,
          reportContext,
          threadId,
          userId
        })
      });

      if (!response.ok) {
        throw new Error(`Chat error: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Update threadId if returned
      if (result.threadId) {
        setThreadId(result.threadId);
      }
      
      const modelMessage: ChatMessage = { 
        role: 'model', 
        text: result.text || 'Lo siento, no pude generar una respuesta.',
        timestamp: new Date(),
        citations: result.citations,
        source: result.source || 'direct'
      };
      
      setMessages(prev => [...prev, modelMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { 
        role: 'model', 
        text: 'Lo siento, hubo un error al procesar tu pregunta. Por favor intenta de nuevo.',
        timestamp: new Date() 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Get source badge configuration
  const getSourceBadge = (source?: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      'direct': { label: '📄 Cotización', className: 'bg-green-100 text-green-700' },
      'rag': { label: '📋 Clausulado', className: 'bg-blue-100 text-blue-700' },
      'ontology': { label: '📋 Ontología', className: 'bg-purple-100 text-purple-700' },
      'fallback': { label: 'ℹ️ General', className: 'bg-amber-100 text-amber-700' }
    };
    return configs[source || 'direct'] || configs['direct'];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 w-[90vw] md:w-[450px] h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col border border-slate-200 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
      {/* Header */}
      <div className="bg-indigo-600 p-4 rounded-t-2xl flex justify-between items-center text-white">
        <div className="flex items-center space-x-2">
          <Bot size={20} />
          <div>
            <span className="font-semibold">SeguroBot AI</span>
            <span className="text-xs text-indigo-200 ml-2">Expert</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded transition-colors">
            <Minimize2 size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4 scrollbar-thin bg-slate-50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-none' 
                : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-sm'
            }`}>
              {msg.isThinking ? (
                <div className="flex items-center space-x-2 text-slate-500">
                  <Loader2 size={14} className="animate-spin" />
                  <span>Pensando...</span>
                </div>
              ) : (
                <div>
                  {/* Source Badge for model messages */}
                  {msg.role === 'model' && msg.source && (
                    <div className="flex items-center gap-1 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getSourceBadge(msg.source).className}`}>
                        {getSourceBadge(msg.source).label}
                      </span>
                    </div>
                  )}
                  <ReactMarkdown 
                    components={{
                      ul: ({node, ...props}) => <ul className="list-disc pl-4 my-1" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal pl-4 my-1" {...props} />,
                      p: ({node, ...props}) => <p className="mb-1 last:mb-0" {...props} />
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                  
                  {/* Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
                        <BookOpen size={12} />
                        <span>Fuentes:</span>
                      </div>
                      <div className="space-y-2">
                        {msg.citations.map((citation, cidx) => (
                          <div key={cidx} className="bg-slate-50 rounded p-2 text-xs border border-slate-100">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-700">{citation.insurerName}</span>
                              <span className="text-slate-400">Pág. {citation.pageNumber}</span>
                            </div>
                            <p className="text-slate-600 mt-1 italic">"{citation.content.substring(0, 100)}..."</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* Suggestions */}
        {showSuggestions && suggestions.length > 0 && !isLoading && (
          <div className="mt-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <Lightbulb size={12} />
              <span>Preguntas sugeridas:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(undefined, suggestion)}
                  className="text-xs bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 rounded-full px-3 py-1.5 text-slate-600 transition-colors text-left"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-100 bg-white rounded-b-2xl">
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2 bg-slate-100 rounded-full px-4 py-2 border border-transparent focus-within:border-indigo-300 focus-within:bg-white transition-all">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta sobre las pólizas..."
            className="flex-grow bg-transparent outline-none text-sm text-slate-800 placeholder-slate-400"
            disabled={isLoading}
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatBot;
