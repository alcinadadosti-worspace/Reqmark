import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EyeOff, PackagePlus, Pencil, Trash2 } from 'lucide-react';
import { ItemIcon } from '@/components/icons/ItemIcon';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Overlay';
import { EmptyState } from '@/components/ui/Feedback';
import { Pill } from '@/components/ui/StatusChip';
import { cn } from '@/lib/cn';
import { ApiError, api } from '@/lib/api';
import type { Item } from '@/shared/types';
import { ItemFormDialog } from './ItemFormDialog';

export interface AdminItemsProps {
  items: Item[];
}

/** CRUD de itens (seção 8.6). */
export function AdminItems({ items }: AdminItemsProps) {
  const [editing, setEditing] = useState<Item | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [removing, setRemoving] = useState(false);

  const categories = useMemo(
    () => [...new Set(items.map((item) => item.category).filter(Boolean))].sort(),
    [items]
  );

  const remove = async () => {
    if (!deleting || removing) return;
    setRemoving(true);
    try {
      await api.deleteItem(deleting.id);
      toast.success('Item removido');
      setDeleting(null);
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : 'Não consegui remover o item.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {items.length} {items.length === 1 ? 'item cadastrado' : 'itens cadastrados'}
        </p>
        <Button onClick={() => setCreating(true)} icon={<PackagePlus className="h-4 w-4" aria-hidden />}>
          Novo item
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<PackagePlus className="h-7 w-7" strokeWidth={1.2} aria-hidden />}
          title="Nenhum item ainda"
          description="Cadastre os materiais do Marketing para a equipe poder requisitar."
          action={<Button onClick={() => setCreating(true)}>Cadastrar o primeiro</Button>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn('glass flex items-start gap-3 p-4', !item.active && 'opacity-60')}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gold-500/20 bg-gold-500/6 text-gold-300">
                <ItemIcon name={item.icon} emoji={item.emoji} className="h-5 w-5" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 truncate text-sm font-medium text-ivory">{item.name}</p>
                  {!item.active ? (
                    <Pill className="!px-1.5 !py-0.5 !text-[0.6rem]">
                      <EyeOff className="h-2.5 w-2.5" aria-hidden />
                      Inativo
                    </Pill>
                  ) : null}
                </div>

                <p className="mt-0.5 text-2xs text-muted">
                  {item.category} · {item.quantity} un.
                  {item.storageLocation ? ` · ${item.storageLocation}` : ''}
                </p>

                {item.attributes.length > 0 ? (
                  <p className="clamp-2 mt-1.5 text-2xs text-muted/80">
                    {item.attributes.map((attribute) => `${attribute.label}: ${attribute.value}`).join(' · ')}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(item)}
                  className="rounded-lg p-2 text-muted transition-colors hover:bg-onyx-800 hover:text-gold-300"
                  aria-label={`Editar ${item.name}`}
                >
                  <Pencil className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(item)}
                  className="rounded-lg p-2 text-muted transition-colors hover:bg-status-rejected/10 hover:text-status-rejected"
                  aria-label={`Remover ${item.name}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ItemFormDialog
        open={creating || editing !== null}
        item={editing}
        categories={categories}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Remover item?"
        description={deleting?.name}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)} disabled={removing}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={remove} loading={removing}>
              Remover
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          As requisições antigas guardam o nome e o ícone do item, então o histórico continua
          legível. Se a ideia é só tirar de circulação, prefira marcar o item como{' '}
          <strong className="text-ivory">inativo</strong> na edição — assim ele some do catálogo sem
          sumir do cadastro.
        </p>
      </Modal>
    </div>
  );
}
