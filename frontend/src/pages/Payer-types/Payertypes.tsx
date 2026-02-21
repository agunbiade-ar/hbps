import { useState, useEffect, useCallback, useMemo } from 'react';
import './payer-type-styles.scss';
import {
  useGetPayerTypesQuery,
  useCreatePayerMutation,
  useUpdatePayerMutation,
  useDeletePayerMutation,
} from '../../api/Payers';

// =========================================================================
// Icons
// =========================================================================
const Icon = ({ name, size = 20 }: { name: string; size?: number }) => {
  const icons: Record<string, JSX.Element> = {
    payer: (
      <svg
        width={size}
        height={size}
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <rect x='2' y='5' width='20' height='14' rx='2' />
        <line x1='2' y1='10' x2='22' y2='10' />
      </svg>
    ),
    plus: (
      <svg
        width={size}
        height={size}
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2.5'
        strokeLinecap='round'
      >
        <line x1='12' y1='5' x2='12' y2='19' />
        <line x1='5' y1='12' x2='19' y2='12' />
      </svg>
    ),
    edit: (
      <svg
        width={size}
        height={size}
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7' />
        <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z' />
      </svg>
    ),
    trash: (
      <svg
        width={size}
        height={size}
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <polyline points='3 6 5 6 21 6' />
        <path d='M19 6l-1 14H6L5 6' />
        <path d='M10 11v6' />
        <path d='M14 11v6' />
        <path d='M9 6V4h6v2' />
      </svg>
    ),
    search: (
      <svg
        width={size}
        height={size}
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <circle cx='11' cy='11' r='8' />
        <line x1='21' y1='21' x2='16.65' y2='16.65' />
      </svg>
    ),
    x: (
      <svg
        width={size}
        height={size}
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2.5'
        strokeLinecap='round'
      >
        <line x1='18' y1='6' x2='6' y2='18' />
        <line x1='6' y1='6' x2='18' y2='18' />
      </svg>
    ),
    check: (
      <svg
        width={size}
        height={size}
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2.5'
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <polyline points='20 6 9 17 4 12' />
      </svg>
    ),
    alert: (
      <svg
        width={size}
        height={size}
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <circle cx='12' cy='12' r='10' />
        <line x1='12' y1='8' x2='12' y2='12' />
        <line x1='12' y1='16' x2='12.01' y2='16' />
      </svg>
    ),
    eye: (
      <svg
        width={size}
        height={size}
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z' />
        <circle cx='12' cy='12' r='3' />
      </svg>
    ),
  };
  return icons[name] || null;
};

// =========================================================================
// Button Component
// =========================================================================
const Btn = ({
  children,
  onClick,
  variant = 'primary',
  disabled,
  small,
  danger,
  icon,
}: any) => {
  const v = danger ? 'danger' : variant;
  const size = small ? 'sm' : 'md';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`pt-btn pt-btn--${v} pt-btn--${size}`}
    >
      {icon && <Icon name={icon} size={small ? 15 : 17} />}
      {children}
    </button>
  );
};

// =========================================================================
// Toast Component
// =========================================================================
const Toast = ({ toasts, remove }: any) => {
  return (
    <div className='pt-toast-stack'>
      {toasts.map((t: any) => (
        <div key={t.id} className={`pt-toast pt-toast--${t.type}`}>
          <Icon name={t.type === 'success' ? 'check' : 'alert'} size={18} />
          <span className='pt-toast__message'>{t.message}</span>
          <button className='pt-toast__close' onClick={() => remove(t.id)}>
            <Icon name='x' size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

// =========================================================================
// Modal Component
// =========================================================================
const Modal = ({ open, title, onClose, children, footer }: any) => {
  if (!open) return null;
  return (
    <div className='pt-overlay' onClick={onClose}>
      <div className='pt-modal' onClick={(e) => e.stopPropagation()}>
        <div className='pt-modal__header'>
          <h2 className='pt-modal__title'>{title}</h2>
          <button className='pt-modal__close' onClick={onClose}>
            <Icon name='x' size={20} />
          </button>
        </div>
        <div className='pt-modal__body'>{children}</div>
        {footer && <div className='pt-modal__footer'>{footer}</div>}
      </div>
    </div>
  );
};

// =========================================================================
// Form Components
// =========================================================================
const Field = ({ label, hint, error, children }: any) => {
  return (
    <div className='pt-field'>
      <label className='pt-field__label'>{label}</label>
      {children}
      {hint && <p className='pt-field__hint'>{hint}</p>}
      {error && <p className='pt-field__error'>{error}</p>}
    </div>
  );
};

const Input = ({
  value,
  onChange,
  placeholder,
  error,
  disabled,
  mono,
}: any) => {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={[
        'pt-input',
        mono ? 'pt-input--mono' : '',
        error ? 'pt-input--error' : '',
      ].join(' ')}
    />
  );
};

// =========================================================================
// Delete Modal
// =========================================================================
const DeleteModal = ({ payer, onConfirm, onClose }: any) => {
  return (
    <Modal
      open={!!payer}
      title='Delete Payer Type'
      onClose={onClose}
      footer={
        <>
          <Btn variant='secondary' onClick={onClose}>
            Cancel
          </Btn>
          <Btn danger onClick={onConfirm} icon='trash'>
            Delete
          </Btn>
        </>
      }
    >
      <div className='pt-delete'>
        <div className='pt-delete__icon-wrap'>
          <Icon name='trash' size={26} />
        </div>
        <p className='pt-delete__heading'>Are you sure?</p>
        <p className='pt-delete__body'>
          This will permanently delete payer type{' '}
          <strong>{payer?.payer_name}</strong>{' '}
          <span className='pt-delete__code'>({payer?.payer_code})</span>. This
          action cannot be undone.
        </p>
      </div>
    </Modal>
  );
};

// =========================================================================
// View Modal
// =========================================================================
const ViewModal = ({ payer, onClose }: any) => {
  return (
    <Modal
      open={!!payer}
      title='Payer Details'
      onClose={onClose}
      footer={
        <Btn variant='secondary' onClick={onClose}>
          Close
        </Btn>
      }
    >
      {payer && (
        <div className='pt-detail-list'>
          {[
            ['ID', `#${payer.id}`, false],
            ['Payer Code', payer.payer_code, true],
            ['Payer Name', payer.payer_name, false],
          ].map(([key, val, isCode]) => (
            <div key={key as string} className='pt-detail-list__row'>
              <span className='pt-detail-list__key'>{key}</span>
              <span
                className={`pt-detail-list__value${isCode ? ' pt-detail-list__value--code' : ''}`}
              >
                {val}
              </span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

// =========================================================================
// Payer Form Modal
// =========================================================================
const PayerFormModal = ({ open, initial, onClose, onSave }: any) => {
  const [form, setForm] = useState({ payer_code: '', payer_name: '' });
  const [errors, setErrors] = useState({ payer_name: '', payer_code: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        initial
          ? { payer_code: initial.payer_code, payer_name: initial.payer_name }
          : { payer_code: '', payer_name: '' },
      );
      setErrors({ payer_code: '', payer_name: '' });
    }
  }, [open, initial]);

  const validate = () => {
    const e: any = {};
    if (!form.payer_code.trim()) e.payer_code = 'Payer code is required';
    else if (form.payer_code.length > 10) e.payer_code = 'Max 10 characters';
    if (!form.payer_name.trim()) e.payer_name = 'Payer name is required';
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setLoading(true);
    try {
      await onSave(form);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      title={initial ? 'Edit Payer Type' : 'Create Payer Type'}
      onClose={onClose}
      footer={
        <>
          <Btn variant='secondary' onClick={onClose} disabled={loading}>
            Cancel
          </Btn>
          <Btn
            onClick={handleSave}
            disabled={loading}
            icon={initial ? 'check' : 'plus'}
          >
            {loading ? 'Saving…' : initial ? 'Save Changes' : 'Create Payer'}
          </Btn>
        </>
      }
    >
      <Field
        label='Payer Code'
        hint='Short identifier, max 10 chars. Auto-uppercased.'
        error={errors.payer_code}
      >
        <Input
          value={form.payer_code}
          mono
          onChange={(e: any) =>
            setForm((f) => ({ ...f, payer_code: e.target.value.toUpperCase() }))
          }
          placeholder='e.g. NHIS'
          error={errors.payer_code}
        />
      </Field>
      <Field label='Payer Name' error={errors.payer_name}>
        <Input
          value={form.payer_name}
          onChange={(e: any) =>
            setForm((f) => ({ ...f, payer_name: e.target.value }))
          }
          placeholder='e.g. National Health Insurance Scheme'
          error={errors.payer_name}
        />
      </Field>
    </Modal>
  );
};

// =========================================================================
// Main Component
// =========================================================================
export const PayerTypeManagement = () => {
  const payerTypesQuery = useGetPayerTypesQuery({});
  const [createPayer] = useCreatePayerMutation();
  const [updatePayer] = useUpdatePayerMutation();
  const [deletePayer] = useDeletePayerMutation();

  const payers = useMemo(() => {
    return payerTypesQuery.data?.payer_types ?? [];
  }, [payerTypesQuery]);

  const [search, setSearch] = useState('');
  const [toasts, setToasts] = useState<any[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [viewTarget, setViewTarget] = useState<any>(null);

  const addToast = useCallback((message: string, type = 'success') => {
    const id = Date.now();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const removeToast = useCallback(
    (id: number) => setToasts((t) => t.filter((x) => x.id !== id)),
    [],
  );

  const filtered = payers.filter(
    (p: any) =>
      p.payer_name.toLowerCase().includes(search.toLowerCase()) ||
      p.payer_code.toLowerCase().includes(search.toLowerCase()) ||
      String(p.id).includes(search),
  );

  // CRUD handlers
  const handleCreate = async (form: any) => {
    try {
      await createPayer({ body: form }).unwrap();
      addToast(`Payer "${form.payer_name}" created successfully.`);
      setFormOpen(false);
      payerTypesQuery.refetch();
    } catch (error: any) {
      addToast(error?.data?.detail || 'Failed to create payer', 'error');
    }
  };

  const handleEdit = async (form: any) => {
    try {
      console.log(form);
      const res = await updatePayer({ id: editTarget.id, body: form }).unwrap();
      if (res.message)
        addToast(`Payer "${form.payer_name}" updated successfully.`);
      setEditTarget(null);
      setFormOpen(false);
      payerTypesQuery.refetch();
    } catch (error: any) {
      addToast(error?.data?.detail || 'Failed to update payer', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      const res = await deletePayer(deleteTarget.id).unwrap();
      if (res.message) addToast(`Payer "${deleteTarget.payer_name}" deleted.`);
      setDeleteTarget(null);
      payerTypesQuery.refetch();
    } catch (error: any) {
      addToast(error?.data?.detail || 'Failed to delete payer', 'error');
    }
  };

  const openEdit = (payer: any) => {
    setEditTarget(payer);
    setFormOpen(true);
  };

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  return (
    <>
      <Toast toasts={toasts} remove={removeToast} />

      <PayerFormModal
        open={formOpen}
        initial={editTarget}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        onSave={editTarget ? handleEdit : handleCreate}
      />
      <DeleteModal
        payer={deleteTarget}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
      <ViewModal payer={viewTarget} onClose={() => setViewTarget(null)} />

      <div className='pt-page'>
        {/* Header */}
        <div className='pt-header'>
          <div className='pt-header__left'>
            <div className='pt-header__icon'>
              <Icon name='payer' size={28} />
            </div>
            <div>
              <h1 className='pt-header__title'>Payer Types</h1>
              <p className='pt-header__subtitle'>
                Manage insurance and payment type configurations for the billing
                system
              </p>
            </div>
          </div>
          <Btn onClick={openCreate} icon='plus'>
            Add Payer Type
          </Btn>
        </div>

        {/* Card */}
        <div className='pt-card'>
          {/* Toolbar */}
          <div className='pt-toolbar'>
            <div className='pt-toolbar__search-wrap'>
              <span className='pt-toolbar__search-icon'>
                <Icon name='search' size={17} />
              </span>
              <input
                className='pt-toolbar__search-input'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder='Search by code, name, or ID…'
              />
              {search && (
                <button
                  className='pt-toolbar__clear-btn'
                  onClick={() => setSearch('')}
                >
                  <Icon name='x' size={15} />
                </button>
              )}
            </div>
            <span className='pt-toolbar__count'>
              {filtered.length} {filtered.length === 1 ? 'record' : 'records'}
            </span>
          </div>

          {/* Table */}
          <div className='pt-table-wrap'>
            <table className='pt-table'>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Payer Code</th>
                  <th>Payer Name</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payerTypesQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {[60, 100, 200, 90].map((w, j) => (
                        <td key={j}>
                          <div
                            className='pt-skeleton'
                            style={{ height: 18, width: w }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className='pt-empty'>
                        <div className='pt-empty__icon'>
                          <Icon name='search' size={44} />
                        </div>
                        <p className='pt-empty__text'>
                          {search
                            ? `No results for "${search}"`
                            : 'No payer types found.'}
                        </p>
                        {!search && (
                          <Btn onClick={openCreate} icon='plus' small>
                            Add First Payer
                          </Btn>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((payer: any, idx: number) => (
                    <tr
                      key={payer.id}
                      style={{ animationDelay: `${idx * 0.045}s` }}
                    >
                      <td className='pt-table__id'>{payer.id}</td>
                      <td>
                        <span className='pt-table__code-badge'>
                          {payer.payer_code}
                        </span>
                      </td>
                      <td className='pt-table__name'>{payer.payer_name}</td>
                      <td>
                        <div className='pt-table__actions'>
                          <button
                            className='pt-action-btn'
                            title='View'
                            onClick={() => setViewTarget(payer)}
                          >
                            <Icon name='eye' size={17} />
                          </button>
                          <button
                            className='pt-action-btn'
                            title='Edit'
                            onClick={() => openEdit(payer)}
                          >
                            <Icon name='edit' size={17} />
                          </button>
                          <button
                            className='pt-action-btn pt-action-btn--danger'
                            title='Delete'
                            onClick={() => setDeleteTarget(payer)}
                          >
                            <Icon name='trash' size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {!payerTypesQuery.isLoading && payers.length > 0 && (
            <div className='pt-card-footer'>
              <span className='pt-card-footer__total'>
                Total: <strong>{payers.length}</strong> payer types
              </span>
              <button
                className='pt-card-footer__refresh'
                onClick={() => payerTypesQuery.refetch()}
              >
                ↺ Refresh
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
