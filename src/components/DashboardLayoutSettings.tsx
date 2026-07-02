'use client';
import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, OnDragEndResponder } from '@hello-pangea/dnd';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { GripVertical, RotateCcw, EyeOff, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export type CardId = 'studyPet' | 'focus' | 'todo' | 'deadlines' | 'achievements' | 'continueWork';

export interface DashboardLayout {
  columns: {
    [key: string]: CardId[];
  };
  hidden: CardId[];
}

const CARD_TITLES: Record<CardId, string> = {
  studyPet: 'Study Pet',
  focus: "Today's Focus",
  todo: 'To-do List',
  deadlines: 'Upcoming Deadlines',
  achievements: 'Achievements',
  continueWork: 'Continue Your Work',
};

const DEFAULT_LAYOUT: DashboardLayout = {
  columns: {
    left: ['studyPet'],
    center: ['focus', 'todo', 'deadlines'],
    right: ['achievements', 'continueWork'],
  },
  hidden: [],
};

interface DashboardLayoutSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: DashboardLayout;
  onSave: (layout: DashboardLayout) => void;
}

export function DashboardLayoutSettings({
  open,
  onOpenChange,
  layout: initialLayout,
  onSave,
}: DashboardLayoutSettingsProps) {
  const [tempLayout, setTempLayout] = useState<DashboardLayout>(initialLayout);

  useEffect(() => {
    if (open) {
      setTempLayout(initialLayout);
    }
  }, [open, initialLayout]);

  const onDragEnd: OnDragEndResponder = (result) => {
    const { source, destination } = result;

    if (!destination) return;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const newLayout = { ...tempLayout };

    // Moving from one column to another (or same column)
    if (source.droppableId !== 'hidden' && destination.droppableId !== 'hidden') {
      const sourceCol = [...newLayout.columns[source.droppableId]];
      const destCol = source.droppableId === destination.droppableId 
        ? sourceCol 
        : [...newLayout.columns[destination.droppableId]];

      const [movedItem] = sourceCol.splice(source.index, 1);
      destCol.splice(destination.index, 0, movedItem);

      newLayout.columns[source.droppableId] = sourceCol;
      if (source.droppableId !== destination.droppableId) {
        newLayout.columns[destination.droppableId] = destCol;
      }
    } 
    // Hiding an item
    else if (source.droppableId !== 'hidden' && destination.droppableId === 'hidden') {
      const sourceCol = [...newLayout.columns[source.droppableId]];
      const [movedItem] = sourceCol.splice(source.index, 1);
      newLayout.columns[source.droppableId] = sourceCol;
      newLayout.hidden = [...newLayout.hidden, movedItem];
    }
    // Showing a hidden item
    else if (source.droppableId === 'hidden' && destination.droppableId !== 'hidden') {
      const hidden = [...newLayout.hidden];
      const [movedItem] = hidden.splice(source.index, 1);
      const destCol = [...newLayout.columns[destination.droppableId]];
      destCol.splice(destination.index, 0, movedItem);
      newLayout.hidden = hidden;
      newLayout.columns[destination.droppableId] = destCol;
    }
    // Reordering hidden items
    else if (source.droppableId === 'hidden' && destination.droppableId === 'hidden') {
      const hidden = [...newLayout.hidden];
      const [movedItem] = hidden.splice(source.index, 1);
      hidden.splice(destination.index, 0, movedItem);
      newLayout.hidden = hidden;
    }

    setTempLayout(newLayout);
  };

  const handleReset = () => {
    setTempLayout(DEFAULT_LAYOUT);
  };

  const handleSave = () => {
    onSave(tempLayout);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-2xl font-bold">Customize Dashboard</DialogTitle>
          <DialogDescription>
            Drag and drop cards to rearrange your dashboard. Move cards to the "Hidden" section to hide them.
          </DialogDescription>
        </DialogHeader>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-6 p-6">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-y-auto pr-2">
              {Object.entries(tempLayout.columns).map(([colId, cardIds]) => (
                <div key={colId} className="flex flex-col gap-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    {colId} Column
                  </h3>
                  <Droppable droppableId={colId}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={cn(
                          "flex-1 min-h-[200px] rounded-xl border-2 border-dashed p-2 transition-colors",
                          snapshot.isDraggingOver ? "border-primary/50 bg-primary/5" : "border-muted"
                        )}
                      >
                        {cardIds.map((cardId, index) => (
                          <Draggable key={cardId} draggableId={cardId} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={cn(
                                  "group relative flex items-center gap-3 p-3 mb-2 rounded-lg border bg-card shadow-sm transition-all",
                                  snapshot.isDragging ? "z-50 shadow-lg ring-2 ring-primary/20" : "hover:border-primary/50"
                                )}
                              >
                                <div {...provided.dragHandleProps} className="text-muted-foreground hover:text-primary transition-colors">
                                  <GripVertical className="h-4 w-4" />
                                </div>
                                <span className="text-sm font-medium">{CARD_TITLES[cardId]}</span>
                                <button
                                  onClick={() => {
                                    const newLayout = { ...tempLayout };
                                    const sourceCol = [...newLayout.columns[colId]];
                                    const [movedItem] = sourceCol.splice(index, 1);
                                    newLayout.columns[colId] = sourceCol;
                                    newLayout.hidden = [...newLayout.hidden, movedItem];
                                    setTempLayout(newLayout);
                                  }}
                                  className="ml-auto opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded-md transition-all"
                                >
                                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                                </button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>

            <div className="w-full md:w-64 flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
                Hidden Cards
              </h3>
              <Droppable droppableId="hidden">
                {(provided, snapshot) => (
                  <ScrollArea className="flex-1 rounded-xl border-2 border-dashed border-muted p-2">
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={cn(
                        "min-h-[100px] transition-colors",
                        snapshot.isDraggingOver ? "bg-accent/50" : ""
                      )}
                    >
                      {tempLayout.hidden.map((cardId, index) => (
                        <Draggable key={cardId} draggableId={cardId} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={cn(
                                "group relative flex items-center gap-3 p-3 mb-2 rounded-lg border bg-muted/50 transition-all",
                                snapshot.isDragging ? "z-50 shadow-lg ring-2 ring-primary/20" : "hover:border-primary/50"
                              )}
                            >
                              <div {...provided.dragHandleProps} className="text-muted-foreground hover:text-primary transition-colors">
                                <GripVertical className="h-4 w-4" />
                              </div>
                              <span className="text-sm font-medium text-muted-foreground">{CARD_TITLES[cardId]}</span>
                              <button
                                onClick={() => {
                                  const newLayout = { ...tempLayout };
                                  const hidden = [...newLayout.hidden];
                                  const [movedItem] = hidden.splice(index, 1);
                                  newLayout.hidden = hidden;
                                  newLayout.columns.center = [...newLayout.columns.center, movedItem];
                                  setTempLayout(newLayout);
                                }}
                                className="ml-auto opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded-md transition-all"
                              >
                                <PlusCircle className="h-3.5 w-3.5 text-primary" />
                              </button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {tempLayout.hidden.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-24 text-center p-4">
                          <p className="text-xs text-muted-foreground">No hidden cards</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </Droppable>
            </div>
          </div>
        </DragDropContext>

        <DialogFooter className="p-6 border-t bg-muted/30">
          <Button variant="outline" onClick={handleReset} className="mr-auto">
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to Default
          </Button>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
