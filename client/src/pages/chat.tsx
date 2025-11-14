import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, MessageCircle, User, ArrowLeft, Image } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
}

interface Conversation {
  id: string;
  instanceId: string;
  phoneNumber: string;
  messages: string;
  lastMessageAt: string;
  createdAt: string;
  voterName?: string;
}

interface CloneAgentInstance {
  id: string;
  instanceName: string;
  isActive: boolean;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Helper function to extract text from potentially JSON-stringified content
function extractMessageText(content: any): string {
  if (!content) return '';
  
  // If content is a string
  if (typeof content === 'string') {
    const trimmed = content.trim();
    
    // Check if it's multiple JSON objects concatenated (one per line)
    if (trimmed.includes('\n') && trimmed.startsWith('{')) {
      // Take only the first JSON object
      const lines = trimmed.split('\n');
      const firstJsonLine = lines.find(line => line.trim().startsWith('{'));
      if (firstJsonLine) {
        try {
          const parsed = JSON.parse(firstJsonLine.trim());
          if (parsed && typeof parsed === 'object' && 'content' in parsed) {
            return String(parsed.content);
          }
        } catch {
          // Fall through to try parsing the whole thing
        }
      }
    }
    
    // Try to parse as single JSON
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        // If it has a content field, extract it
        if (parsed && typeof parsed === 'object' && 'content' in parsed) {
          return String(parsed.content);
        }
        // Otherwise return the original string
        return content;
      } catch {
        // Not valid JSON, return as-is
        return content;
      }
    }
    
    // Regular string, return as-is
    return content;
  }
  
  // If content is an object
  if (typeof content === 'object' && content !== null) {
    // If it has a 'content' property, extract it
    if ('content' in content) {
      const contentValue = content.content;
      // If content.content is also an object, recursively extract
      if (typeof contentValue === 'object' && contentValue !== null) {
        return extractMessageText(contentValue);
      }
      // Otherwise return as string
      return String(contentValue);
    }
    // If no content field, stringify the object
    return JSON.stringify(content);
  }
  
  // For primitive values, convert to string
  return String(content);
}

// Function to render message content with image tags
function renderMessageContent(content: string, isUser: boolean) {
  const imageTagRegex = /\[Imagem descrita\]/gi;
  
  // Check if the content contains the image tag
  if (!imageTagRegex.test(content)) {
    return <span className="whitespace-pre-wrap break-words">{content}</span>;
  }
  
  // Replace [Imagem descrita]: with just the tag (remove the colon after)
  const cleanedContent = content.replace(/\[Imagem descrita\]\s*:\s*/gi, '[Imagem descrita] ');
  
  // Split the content by the image tag and render parts
  const parts = cleanedContent.split(/(\[Imagem descrita\])/gi);
  
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, idx) => {
        if (part.match(/\[Imagem descrita\]/i)) {
          return (
            <span 
              key={idx} 
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border bg-background text-foreground mr-1 align-middle"
              data-testid="badge-image-described"
            >
              <Image className="w-3.5 h-3.5" />
              Imagem
            </span>
          );
        }
        return part;
      })}
    </span>
  );
}

export default function ChatPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileChat, setShowMobileChat] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Reset mobile chat view when screen becomes desktop size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) { // md breakpoint
        setShowMobileChat(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch Clone Agent instances
  const { data: instances = [] } = useQuery<CloneAgentInstance[]>({
    queryKey: ["/api/clone-agent/instances"],
  });

  // Fetch conversations with polling (refetch every 5 seconds when window is focused)
  const { data: conversations = [], isLoading: loadingConversations } = useQuery<Conversation[]>({
    queryKey: [
      "/api/clone-agent/conversations",
      selectedInstanceId,
      debouncedSearch,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedInstanceId !== "all") {
        params.append("instanceId", selectedInstanceId);
      }
      if (debouncedSearch) {
        params.append("search", debouncedSearch);
      }
      params.append("limit", "30");
      
      const url = `/api/clone-agent/conversations?${params.toString()}`;
      const res = await apiRequest(url);
      return res.json();
    },
    refetchInterval: (query) => {
      // Only refetch if window is focused
      return document.visibilityState === "visible" ? 5000 : false;
    },
  });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: loadingMessages } = useQuery<Message[]>({
    queryKey: ["/api/clone-agent/conversations", selectedConversationId, "messages?limit=50"],
    enabled: !!selectedConversationId,
  });

  // Auto-select first conversation if none is selected
  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  // Get selected conversation details
  const selectedConversation = useMemo(() => {
    return conversations.find((c) => c.id === selectedConversationId);
  }, [conversations, selectedConversationId]);

  // Reset mobile chat if selected conversation disappears (filtered/removed)
  useEffect(() => {
    if (showMobileChat && !selectedConversation) {
      setShowMobileChat(false);
    }
  }, [showMobileChat, selectedConversation]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border p-4 bg-card">
        <h1 className="text-2xl font-bold text-card-foreground">Chat - Conversas do Clone Agent</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualize e acompanhe todas as conversas em tempo real
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversations List - Left Column */}
        <div className={`w-full md:w-96 border-r border-border flex-col bg-card ${
          showMobileChat ? "hidden md:flex" : "flex"
        }`}>
          {/* Filters */}
          <div className="p-4 space-y-3 border-b border-border">
            <Select value={selectedInstanceId} onValueChange={setSelectedInstanceId} data-testid="select-instance">
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por instância" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-instance-all">
                  Todas as instâncias
                </SelectItem>
                {instances.map((instance) => (
                  <SelectItem key={instance.id} value={instance.id} data-testid={`option-instance-${instance.id}`}>
                    {instance.instanceName}
                    {!instance.isActive && " (Inativa)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
          </div>

          {/* Conversations List */}
          <ScrollArea className="flex-1">
            {loadingConversations ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <MessageCircle className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground" data-testid="text-no-conversations">
                  Nenhuma conversa encontrada
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {conversations.map((conversation) => {
                  const parsedMessages: Message[] = JSON.parse(conversation.messages || "[]");
                  const lastMessage = parsedMessages[parsedMessages.length - 1];
                  const displayName = conversation.voterName || conversation.phoneNumber;
                  const isSelected = conversation.id === selectedConversationId;

                  return (
                    <button
                      key={conversation.id}
                      onClick={() => {
                        setSelectedConversationId(conversation.id);
                        setShowMobileChat(true); // Show chat in mobile view
                      }}
                      className={`w-full p-4 flex items-start gap-3 hover:bg-accent transition-colors text-left ${
                        isSelected ? "bg-accent" : ""
                      }`}
                      data-testid={`conversation-${conversation.id}`}
                    >
                      <Avatar className="w-12 h-12 flex-shrink-0">
                        <AvatarFallback>
                          <User className="w-6 h-6" />
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-card-foreground truncate" data-testid={`text-name-${conversation.id}`}>
                            {displayName}
                          </p>
                          <p className="text-xs text-muted-foreground flex-shrink-0 ml-2" data-testid={`text-time-${conversation.id}`}>
                            {formatDistanceToNow(new Date(conversation.lastMessageAt), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </p>
                        </div>

                        {lastMessage && (
                          <p className="text-sm text-muted-foreground truncate" data-testid={`text-last-message-${conversation.id}`}>
                            {lastMessage.role === "assistant" && "Clone: "}
                            {extractMessageText(lastMessage.content)}
                          </p>
                        )}

                        <p className="text-xs text-muted-foreground mt-1" data-testid={`text-phone-${conversation.id}`}>
                          {conversation.phoneNumber}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Chat Thread - Right Column */}
        <div className={`flex-1 flex-col bg-background ${
          showMobileChat ? "flex" : "hidden md:flex"
        }`}>
          {!selectedConversation ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="w-20 h-20 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg text-muted-foreground" data-testid="text-select-conversation">
                  Selecione uma conversa para visualizar
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="border-b border-border p-4 bg-card">
                <div className="flex items-center gap-3">
                  {/* Back button - visible only on mobile */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowMobileChat(false)}
                    className="md:hidden flex-shrink-0"
                    aria-label="Voltar para lista de conversas"
                    data-testid="button-back-mobile"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  
                  <Avatar className="w-10 h-10">
                    <AvatarFallback>
                      <User className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h2 className="font-semibold text-card-foreground" data-testid="text-chat-name">
                      {selectedConversation.voterName || selectedConversation.phoneNumber}
                    </h2>
                    <p className="text-sm text-muted-foreground" data-testid="text-chat-phone">
                      {selectedConversation.phoneNumber}
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {loadingMessages ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className={i % 2 === 0 ? "flex justify-end" : "flex justify-start"}>
                        <Skeleton className="h-16 w-64 rounded-lg" />
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground" data-testid="text-no-messages">
                      Nenhuma mensagem nesta conversa
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message: Message, index: number) => {
                      const isUser = message.role === "user";
                      const isSystem = message.role === "system";

                      if (isSystem) {
                        return (
                          <div key={index} className="flex justify-center">
                            <p className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full" data-testid={`message-system-${index}`}>
                              {extractMessageText(message.content)}
                            </p>
                          </div>
                        );
                      }

                      const messageText = extractMessageText(message.content);

                      return (
                        <div
                          key={index}
                          className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                          data-testid={`message-${message.role}-${index}`}
                        >
                          <Card
                            className={`max-w-md p-3 ${
                              isUser
                                ? "bg-primary text-primary-foreground"
                                : "bg-card text-card-foreground"
                            }`}
                          >
                            <div className="text-sm" data-testid={`text-message-content-${index}`}>
                              {renderMessageContent(messageText, isUser)}
                            </div>
                            {message.timestamp && (
                              <p
                                className={`text-xs mt-1 ${
                                  isUser ? "text-primary-foreground/70" : "text-muted-foreground"
                                }`}
                                data-testid={`text-message-time-${index}`}
                              >
                                {formatDistanceToNow(new Date(message.timestamp), {
                                  addSuffix: true,
                                  locale: ptBR,
                                })}
                              </p>
                            )}
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
