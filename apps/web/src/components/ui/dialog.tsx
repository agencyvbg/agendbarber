import { Dialog as Primitive } from 'radix-ui';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm" />
        <Primitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl">
          <Primitive.Title className="text-xl font-semibold pr-8">{title}</Primitive.Title>
          <Primitive.Description className="text-sm text-muted-foreground mt-2 mb-6">
            {description || 'Preencha os dados abaixo.'}
          </Primitive.Description>
          <Primitive.Close
            className="absolute top-5 right-5 text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X size={19} />
          </Primitive.Close>
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
