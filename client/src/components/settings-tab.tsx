import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ConfigOption, InsertConfigOption } from "@shared/schema";

export default function SettingsTab() {
  const [newValues, setNewValues] = useState({
    municipio: "",
    bairro: ""
  });
  const [selectedMunicipio, setSelectedMunicipio] = useState("");
  const [openSections, setOpenSections] = useState<string[]>([]);
  const [loadedItems, setLoadedItems] = useState<Record<string, number>>({});

  // Query to get all config options
  const { data: configOptions = [], isLoading } = useQuery<ConfigOption[]>({
    queryKey: ['/api/config-options'],
  });
  
  // Query to get municipios for bairro selection
  const { data: municipios = [] } = useQuery<ConfigOption[]>({
    queryKey: ['/api/config-options/municipio'],
  });

  // Mutations for creating and deleting config options
  const createOptionMutation = useMutation({
    mutationFn: (data: InsertConfigOption) => apiRequest('/api/config-options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      // Invalidate all config-related queries including specific field type queries
      queryClient.invalidateQueries({ predicate: (query) => {
        return !!(query.queryKey[0] && typeof query.queryKey[0] === 'string' && 
          query.queryKey[0].startsWith('/api/config-options'));
      }});
    },
    onError: () => {
    },
  });

  const deleteOptionMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/config-options/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      // Invalidate all config-related queries including specific field type queries
      queryClient.invalidateQueries({ predicate: (query) => {
        return !!(query.queryKey[0] && typeof query.queryKey[0] === 'string' && 
          query.queryKey[0].startsWith('/api/config-options'));
      }});
    },
    onError: () => {
    },
  });

  // Filter options by field type
  const getOptionsByType = (fieldType: string) => {
    return configOptions.filter(option => option.fieldType === fieldType);
  };

  // Add new option
  const handleAddOption = (fieldType: string) => {
    const value = newValues[fieldType as keyof typeof newValues].trim();
    if (!value) return;
    
    // Se for bairro, precisa ter município selecionado
    if (fieldType === 'bairro' && !selectedMunicipio) {
      return;
    }

    const optionData: InsertConfigOption = {
      fieldType,
      value
    };
    
    // Adicionar parentMunicipio se for bairro
    if (fieldType === 'bairro' && selectedMunicipio) {
      optionData.parentMunicipio = selectedMunicipio;
    }

    createOptionMutation.mutate(optionData);

    // Clear the input
    setNewValues(prev => ({
      ...prev,
      [fieldType]: ""
    }));
    
    // Clear município selection for bairro
    if (fieldType === 'bairro') {
      setSelectedMunicipio("");
    }
  };

  // Delete option
  const handleDeleteOption = (id: string) => {
    if (confirm("Tem certeza que deseja remover esta opção?")) {
      deleteOptionMutation.mutate(id);
    }
  };

  const fieldTypes = [
    {
      key: 'municipio',
      title: 'Opções de Município',
      description: 'Gerencie as opções disponíveis para o campo Município'
    },
    {
      key: 'bairro',
      title: 'Opções de Bairro',
      description: 'Gerencie as opções disponíveis para o campo Bairro'
    }
  ];

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="p-8">
          <div className="flex justify-center items-center h-32">
            <div className="text-muted-foreground">Carregando configurações...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground">Configurações</h2>
          <p className="text-muted-foreground mt-2">Gerencie as opções dos campos do sistema</p>
        </div>

        {/* Configuration Sections */}
        <div className="space-y-6">
          {fieldTypes.map((fieldType) => {
            const options = getOptionsByType(fieldType.key);
            const isOpen = openSections.includes(fieldType.key);
            
            return (
              <Card key={fieldType.key}>
                <Collapsible
                  open={isOpen}
                  onOpenChange={(open) => {
                    setOpenSections(prev =>
                      open
                        ? [...prev, fieldType.key]
                        : prev.filter(key => key !== fieldType.key)
                    );
                    // Reset loaded items when opening a section
                    if (open) {
                      setLoadedItems(prev => ({
                        ...prev,
                        [fieldType.key]: 5
                      }));
                    }
                  }}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-accent/5 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{fieldType.title}</CardTitle>
                          <CardDescription>{fieldType.description}</CardDescription>
                        </div>
                        <ChevronDown
                          className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 pt-0">
                      {/* Add new option */}
                      <div className="space-y-2">
                        {/* Se for bairro, mostrar seletor de município */}
                        {fieldType.key === 'bairro' && (
                          <Select
                            value={selectedMunicipio}
                            onValueChange={setSelectedMunicipio}
                          >
                            <SelectTrigger data-testid="select-municipio-for-bairro">
                              <SelectValue placeholder="Selecione o município para este bairro" />
                            </SelectTrigger>
                            <SelectContent>
                              {municipios.map((municipio) => (
                                <SelectItem key={municipio.id} value={municipio.value}>
                                  {municipio.value}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        <div className="flex gap-2">
                          <Input
                            data-testid={`input-new-${fieldType.key}`}
                            placeholder={`Nova opção de ${fieldType.title.toLowerCase()}`}
                            value={newValues[fieldType.key as keyof typeof newValues]}
                            onChange={(e) => setNewValues(prev => ({
                              ...prev,
                              [fieldType.key]: e.target.value
                            }))}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleAddOption(fieldType.key);
                              }
                            }}
                          />
                          <Button 
                            data-testid={`button-add-${fieldType.key}`}
                            onClick={() => handleAddOption(fieldType.key)}
                            disabled={createOptionMutation.isPending}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Adicionar
                          </Button>
                        </div>
                      </div>

                      {/* List of existing options */}
                      <div className="space-y-2">
                        {options.length === 0 ? (
                          <p className="text-muted-foreground text-sm">
                            Nenhuma opção configurada para este campo.
                          </p>
                        ) : (
                          <>
                            <div 
                              className={`space-y-2 ${options.length > 5 ? 'max-h-[280px] overflow-y-auto pr-2 scrollbar-thin' : ''}`}
                              onScroll={(e) => {
                                const element = e.currentTarget;
                                const scrollPercentage = (element.scrollTop + element.clientHeight) / element.scrollHeight;
                                if (scrollPercentage > 0.8) {
                                  const currentLoaded = loadedItems[fieldType.key] || 5;
                                  if (currentLoaded < options.length) {
                                    setLoadedItems(prev => ({
                                      ...prev,
                                      [fieldType.key]: Math.min(currentLoaded + 5, options.length)
                                    }));
                                  }
                                }
                              }}
                            >
                              {options.slice(0, loadedItems[fieldType.key] || 5).map((option) => (
                            <div
                              key={option.id}
                              data-testid={`option-${fieldType.key}-${option.id}`}
                              className="flex items-center justify-between p-3 border rounded-lg bg-card"
                            >
                              <span className="text-foreground">
                                {option.value}
                                {fieldType.key === 'bairro' && option.parentMunicipio && (
                                  <span className="text-muted-foreground text-sm ml-2">
                                    ({option.parentMunicipio})
                                  </span>
                                )}
                              </span>
                              <Button
                                data-testid={`button-delete-${option.id}`}
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteOption(option.id)}
                                disabled={deleteOptionMutation.isPending}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                            </div>
                            {options.length > 5 && (loadedItems[fieldType.key] || 5) < options.length && (
                              <div className="text-center pt-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const currentLoaded = loadedItems[fieldType.key] || 5;
                                    setLoadedItems(prev => ({
                                      ...prev,
                                      [fieldType.key]: Math.min(currentLoaded + 5, options.length)
                                    }));
                                  }}
                                  className="text-muted-foreground"
                                >
                                  Carregar mais ({Math.min(5, options.length - (loadedItems[fieldType.key] || 5))} de {options.length - (loadedItems[fieldType.key] || 5)} restantes)
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}