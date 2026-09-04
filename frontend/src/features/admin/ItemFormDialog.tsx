import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Overlay';
import { Button } from '@/components/ui/Button';
import { Field, Input, Switch, Textarea } from '@/components/ui/Field';
import { ErrorNotice } from '@/components/ui/Feedback';
import { DataLabel } from '@/components/ui/Surface';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { ApiError, api } from '@/lib/api';
import type { Item, ItemAttribute, ItemInput } from '@/shared/types';
import { IconPicker } from './IconPicker';

export interface ItemFormDialogProps {
  open: boolean;
  /** `null` cria um item novo. */
  item: Item | null;
  categories: string[];
  onClose: () => void;
}

const EMPTY: ItemInput = {
  name: '',
  category: '',
  icon: 'package',
  emoji: '',
  imageUrl: '',
  description: '',
  quantity: 1,
  attributes: [],
  storageLocation: '',
  tags: [],
  active: true,
};

/**
 * Cadastro de item (seção 8.6).
 *
 * As características são dinâmicas: cada item define os próprios pares
 * rótulo/valor ("Dimensões: 3x3 m", "Montagem: 2 pessoas"), porque tenda, mesa
 * e carrinho não têm nada em comum além de nome e quantidade.
 */
export function ItemFormDialog({ open, item, categories, onClose }: ItemFormDialogProps) {
  const [form, setForm] = useState<ItemInput>(EMPTY);
  const [tagsText, setTagsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!open) return;

    setError(null);
    setShowErrors(false);

    if (item) {
      setForm({
        name: item.name,
        category: item.category,
        icon: item.icon,
        emoji: item.emoji ?? '',
        imageUrl: item.imageUrl ?? '',
        description: item.description,
        quantity: item.quantity,
        attributes: item.attributes.map((attribute) => ({ ...attribute })),
        storageLocation: item.storageLocation ?? '',
        tags: item.tags,
        active: item.active,
      });
      setTagsText(item.tags.join(', '));
    } else {
      setForm(EMPTY);
      setTagsText('');
    }
  }, [open, item]);

  const patch = (changes: Partial<ItemInput>) => setForm((current) => ({ ...current, ...changes }));

  const setAttribute = (index: number, changes: Partial<ItemAttribute>) =>
    patch({
      attributes: form.attributes.map((attribute, position) =>
        position === index ? { ...attribute, ...changes } : attribute
      ),
    });

  const nameError = showErrors && !form.name.trim() ? 'Dê um nome ao item.' : undefined;
  const categoryError = showErrors && !form.category.trim() ? 'Informe a categoria.' : undefined;
  const valid = form.name.trim().length > 0 && form.category.trim().length > 0 && form.quantity >= 0;

  const save = async () => {
    if (saving) return;
    if (!valid) {
      setShowErrors(true);
      return;
    }

    setSaving(true);
    setError(null);

    const payload: ItemInput = {
      ...form,
      name: form.name.trim(),
      category: form.category.trim(),
      description: form.description.trim(),
      emoji: form.emoji?.trim() || undefined,
      imageUrl: form.imageUrl?.trim() || undefined,
      storageLocation: form.storageLocation?.trim() || undefined,
      // Descarta características em branco antes de salvar.
      attributes: form.attributes
        .map((attribute) => ({ label: attribute.label.trim(), value: attribute.value.trim() }))
        .filter((attribute) => attribute.label && attribute.value),
      tags: tagsText
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    };

    try {
      if (item) {
        await api.updateItem(item.id, payload);
        toast.success('Item atualizado');
      } else {
        await api.createItem(payload);
        toast.success('Item cadastrado');
      }
      onClose();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Não consegui salvar o item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      persistent={saving}
      title={item ? 'Editar item' : 'Novo item'}
      description={item ? item.name : 'Cadastre um material do Marketing'}
      className="!max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            {item ? 'Salvar alterações' : 'Cadastrar item'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" required error={nameError}>
            {({ id, invalid }) => (
              <Input
                id={id}
                invalid={invalid}
                value={form.name}
                onChange={(event) => patch({ name: event.target.value })}
                placeholder="Ex.: Tenda 3x3"
                maxLength={80}
              />
            )}
          </Field>

          <Field label="Categoria" required error={categoryError} hint="Ex.: Estrutura, Mobiliário, Ativação">
            {({ id, invalid }) => (
              <>
                <Input
                  id={id}
                  invalid={invalid}
                  value={form.category}
                  onChange={(event) => patch({ category: event.target.value })}
                  list="categorias-existentes"
                  placeholder="Estrutura"
                  maxLength={40}
                />
                <datalist id="categorias-existentes">
                  {categories.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
        </div>

        <Field label="Descrição" hint="Uma linha explicando para que serve.">
          {({ id }) => (
            <Textarea
              id={id}
              value={form.description}
              onChange={(event) => patch({ description: event.target.value })}
              placeholder="Tenda branca de 3x3 m usada nas ativações de rua."
              maxLength={300}
              className="min-h-[5rem]"
            />
          )}
        </Field>

        <div className="flex flex-wrap items-center gap-6">
          <div>
            <DataLabel className="mb-2">Unidades existentes</DataLabel>
            <QuantityStepper
              value={form.quantity}
              onChange={(quantity) => patch({ quantity })}
              min={0}
              max={999}
              label={form.name || 'item'}
            />
          </div>

          <Switch
            checked={form.active}
            onChange={(active) => patch({ active })}
            label="Item ativo"
            description="Itens inativos somem do catálogo e do wizard."
          />
        </div>

        <div>
          <DataLabel className="mb-2">Ícone</DataLabel>
          <IconPicker value={form.icon} onChange={(icon) => patch({ icon })} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Emoji (opcional)" hint="Se preenchido, substitui o ícone.">
            {({ id }) => (
              <Input
                id={id}
                value={form.emoji ?? ''}
                onChange={(event) => patch({ emoji: event.target.value })}
                placeholder="⛺"
                maxLength={4}
                className="text-center text-xl"
              />
            )}
          </Field>

          <Field label="Local de guarda (opcional)">
            {({ id }) => (
              <Input
                id={id}
                value={form.storageLocation ?? ''}
                onChange={(event) => patch({ storageLocation: event.target.value })}
                placeholder="Depósito do escritório"
                maxLength={80}
              />
            )}
          </Field>
        </div>

        <Field
          label="URL da imagem (opcional)"
          hint="Só link externo — o plano gratuito do Firebase não inclui armazenamento de arquivos."
        >
          {({ id }) => (
            <Input
              id={id}
              type="url"
              inputMode="url"
              value={form.imageUrl ?? ''}
              onChange={(event) => patch({ imageUrl: event.target.value })}
              placeholder="https://…"
            />
          )}
        </Field>

        <Field label="Etiquetas (opcional)" hint="Separadas por vírgula. Ajudam na busca.">
          {({ id }) => (
            <Input
              id={id}
              value={tagsText}
              onChange={(event) => setTagsText(event.target.value)}
              placeholder="externo, chuva, montagem rápida"
            />
          )}
        </Field>

        {/* Características dinâmicas */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <DataLabel>Características</DataLabel>
            <button
              type="button"
              onClick={() =>
                patch({ attributes: [...form.attributes, { label: '', value: '' }] })
              }
              className="inline-flex items-center gap-1 text-xs text-gold-300 transition-colors hover:text-gold-200"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Adicionar
            </button>
          </div>

          {form.attributes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-onyx-700 px-3 py-4 text-center text-xs text-muted">
              Nenhuma característica. Ex.: “Dimensões · 3x3 m”, “Montagem · 2 pessoas”.
            </p>
          ) : (
            <ul className="space-y-2">
              {form.attributes.map((attribute, index) => (
                <li key={index} className="flex gap-2">
                  <Input
                    value={attribute.label}
                    onChange={(event) => setAttribute(index, { label: event.target.value })}
                    placeholder="Rótulo"
                    aria-label={`Rótulo da característica ${index + 1}`}
                    className="h-11 flex-1"
                    maxLength={40}
                  />
                  <Input
                    value={attribute.value}
                    onChange={(event) => setAttribute(index, { value: event.target.value })}
                    placeholder="Valor"
                    aria-label={`Valor da característica ${index + 1}`}
                    className="h-11 flex-[1.4]"
                    maxLength={80}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      patch({ attributes: form.attributes.filter((_, position) => position !== index) })
                    }
                    className="shrink-0 rounded-xl px-2 text-muted transition-colors hover:bg-status-rejected/10 hover:text-status-rejected"
                    aria-label={`Remover característica ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error ? <ErrorNotice message={error} /> : null}
      </div>
    </Modal>
  );
}
