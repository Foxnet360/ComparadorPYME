import React, { useState, useRef, useEffect } from 'react';
import { Chat, GenerateContentResponse } from "@google/genai";
import { MessageSquare, Send, X, Bot, User, Minimize2, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '../types';

interface ChatBotProps {
  chatSession: Chat | null;
  isOpen: boolean;
  onClose: () => void;
}

const ChatBot: React.FC<ChatBotProps> = ({ chatSession, isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hola, soy tu asistente de seguros. ¿Tienes alguna duda sobre las cotizaciones analizadas?', timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !chatSession || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', text: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Using gemini-3-pro-preview stream via the session passed from parent
      const result = await chatSession.sendMessageStream({ message: userMessage.text });
      
      let fullResponse = "";
      const modelMessage: ChatMessage = { role: 'model', text: '', timestamp: new Date(), isThinking: true };
      setMessages(prev => [...prev, modelMessage]);

      for await (const chunk of result) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          fullResponse += c.text;
          setMessages(prev => {
             const newHistory = [...prev];
             newHistory[newHistory.length - 1] = { 
               ...newHistory[newHistory.length - 1], 
               text: fullResponse,
               isThinking: false
             };
             return newHistory;
          });
        }
      }

    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', text: 'Lo siento, hubo un error al procesar tu pregunta.', timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 w-[90vw] md:w-[400px] h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col border border-slate-200 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
      {/* Header */}
      <div className="bg-indigo-600 p-4 rounded-t-2xl flex justify-between items-center text-white">
        <div className="flex items-center space-x-2">
          <Bot size={20} />
          <span className="font-semibold">SeguroBot AI</span>
        </div>
        <div className="flex space-x-2">
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
                 <ReactMarkdown 
                  components={{
                    ul: ({node, ...props}) => <ul className="list-disc pl-4 my-1" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-4 my-1" {...props} />,
                    p: ({node, ...props}) => <p className="mb-1 last:mb-0" {...props} />
                  }}
                 >
                   {msg.text}
                 </ReactMarkdown>
              )}
            </div>
          </div>
        ))}
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
            disabled={isLoading || !chatSession}
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim() || !chatSession}
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