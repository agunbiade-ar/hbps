import { useState, useMemo, useEffect } from 'react';
import { Pagination } from '@carbon/react';
import useDebounce from '../../hooks/hooks';
import {
  Button,
  Loading,
  InlineNotification,
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Modal,
  NumberInput,
  Select,
  SelectItem,
  Tag,
} from '@carbon/react';
import { Edit, Save, Close, Money, Undo, Search } from '@carbon/icons-react';
import './price-list-management.scss';

// API hooks
import {
  useGetAllItemsQuery,
  useUpdateItemPricesMutation,
} from '../../api/Items';
import { useGetPayerTypesQuery } from '../../api/Payers';

interface BillableItem {
  id: number;
  concept_id: number;
  item_name: string;
  category: string;
  base_price: number;
  created_at: string;
  payer_prices?: PayerPrice[];
}

interface PayerPrice {
  payer_id: number;
  payer_name: string;
  price: number;
}

interface EditedPrice {
  item_id: number;
  payer_id: number;
  price: number;
}

export const PriceListManagement = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(200);

  const [updateItemPrices] = useUpdateItemPricesMutation();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingRows, setEditingRows] = useState<Set<string>>(new Set()); // itemId-payerId
  const [editedPrices, setEditedPrices] = useState<Map<string, EditedPrice>>(
    new Map(),
  );

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  // const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPayerType, setSelectedPayerType] = useState<string>('1'); // 1 for id of self in the db
  const [isSaving, setIsSaving] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch billable items
  const itemsQuery = useGetAllItemsQuery(
    {
      search: debouncedSearch,
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
    },
    {
      refetchOnMountOrArgChange: true,
    },
  );

  const totalItems = itemsQuery.data?.total_items || 0;
  // Fetch payer types
  const payerQuery = useGetPayerTypesQuery({});
  const payerTypes = useMemo(() => {
    return payerQuery.data?.payer_types || [];
  }, [payerQuery]);

  // Update prices mutation
  // const [updatePrices] = useUpdateItemPricesMutation();

  const billableItems = useMemo(() => {
    const items = itemsQuery.data?.billable_items || [];
    return items;
  }, [itemsQuery]);

  // Filter items
  const filteredItems = useMemo(() => {
    const items: BillableItem[] = billableItems;
    return items;
  }, [billableItems, selectedPayerType]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedPayerType]);

  // Get selected payer info
  // console.log(selectedPayerType);
  const selectedPayer = useMemo(() => {
    // if (selectedPayerType === 'all') return null;
    // console.log(payerTypes);
    return payerTypes.find((p: any) => p.id.toString() === selectedPayerType);
  }, [selectedPayerType, payerTypes]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'NGN',
      currencyDisplay: 'code',
    })
      .format(amount)
      .replace('NGN', '₦');
  };

  // Get price for item and payer
  const getItemPrice = (item: BillableItem, payerId: number) => {
    const payerPrice = item.payer_prices?.find((p) => p.payer_id === payerId);
    return payerPrice?.price || item.base_price;
  };

  // Get edit key
  const getEditKey = (itemId: number, payerId: number) => {
    return `${itemId}-${payerId}`;
  };

  // Handle edit button click
  const handleEditClick = (itemId: number, payerId: number) => {
    const key = getEditKey(itemId, payerId);
    const newEditingRows = new Set(editingRows);
    newEditingRows.add(key);
    setEditingRows(newEditingRows);
  };

  // Handle cancel edit
  const handleCancelEdit = (itemId: number, payerId: number) => {
    const key = getEditKey(itemId, payerId);
    const newEditingRows = new Set(editingRows);
    newEditingRows.delete(key);
    setEditingRows(newEditingRows);

    const newEditedPrices = new Map(editedPrices);
    newEditedPrices.delete(key);
    setEditedPrices(newEditedPrices);
  };

  // Handle price change
  const handlePriceChange = (
    itemId: number,
    payerId: number,
    newPrice: number,
  ) => {
    const key = getEditKey(itemId, payerId);
    const newEditedPrices = new Map(editedPrices);
    newEditedPrices.set(key, {
      item_id: itemId,
      payer_id: payerId,
      price: newPrice,
    });
    setEditedPrices(newEditedPrices);
  };

  // Handle save all
  const handleSaveAll = () => {
    if (editedPrices.size === 0) {
      setError('No changes to save');
      return;
    }

    setIsSaveModalOpen(true);
  };

  // Confirm save
  const handleConfirmSave = async () => {
    try {
      setIsSaving(true);
      setError('');

      const items_array = Array.from(editedPrices.values());

      const res = await updateItemPrices({ body: items_array }).unwrap();

      if (res.message)
        setSuccess(
          `Successfully updated ${editedPrices.size} price${editedPrices.size !== 1 ? 's' : ''}!`,
        );
      setEditedPrices(new Map());
      setEditingRows(new Set());
      setIsSaveModalOpen(false);

      // Refetch items to get updated prices
      itemsQuery.refetch();
    } catch (err: any) {
      const errMessage = err?.data?.detail || err?.message || 'Unknown error';
      setError('Failed to save prices: ' + errMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Table headers - dynamic based on selected payer
  const headers = useMemo(() => {
    const baseHeaders = [
      { key: 'itemCode', header: 'ID' },
      { key: 'itemName', header: 'Item Name' },
      { key: 'category', header: 'Category' },
      { key: 'basePrice', header: 'Base Price' },
    ];

    if (selectedPayer) {
      baseHeaders.push(
        { key: 'payerPrice', header: `${selectedPayer.payer_code} Price` },
        { key: 'actions', header: 'Actions' },
      );
    }

    return baseHeaders;
  }, [selectedPayer]);
  // }, [selectedPayerType, selectedPayer, payerTypes]);

  if (itemsQuery.isLoading || payerQuery.isLoading) {
    return (
      <div className='price-list-loading'>
        <Loading description='Loading price list...' withOverlay={false} />
      </div>
    );
  }

  return (
    <div className='price-list-container'>
      {/* Header */}
      <div className='price-list-header'>
        <div className='price-list-header__content'>
          <div className='price-list-header__icon'>
            <Money size={32} />
          </div>
          <div className='price-list-header__text'>
            <h1 className='price-list-header__title'>Price List Management</h1>
            <p className='price-list-header__subtitle'>
              Manage billable item prices by insurance/payer type
            </p>
          </div>
        </div>
        <div className='price-list-header__actions'>
          {editedPrices.size > 0 && (
            <>
              <Button
                kind='ghost'
                size='sm'
                renderIcon={Undo}
                onClick={() => {
                  setEditedPrices(new Map());
                  setEditingRows(new Set());
                }}
                className='price-list-header__reset'
              >
                Reset All
              </Button>
              <Button
                kind='primary'
                renderIcon={Save}
                onClick={handleSaveAll}
                className='price-list-header__save'
              >
                Save {editedPrices.size} Change
                {editedPrices.size !== 1 ? 's' : ''}
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className='price-list-notification'>
          <InlineNotification
            kind='error'
            title='Error'
            subtitle={error}
            onClose={() => setError('')}
          />
        </div>
      )}

      {success && (
        <div className='price-list-notification'>
          <InlineNotification
            kind='success'
            title='Success'
            subtitle={success}
            onClose={() => setSuccess('')}
          />
        </div>
      )}

      {/* Changes Summary */}
      {editedPrices.size > 0 && (
        <div className='price-list-summary'>
          <div className='price-list-summary__content'>
            <div className='price-list-summary__icon'>
              <Edit size={24} />
            </div>
            <div className='price-list-summary__text'>
              <strong>{editedPrices.size}</strong> unsaved change
              {editedPrices.size !== 1 ? 's' : ''}
            </div>
          </div>
          <div className='price-list-summary__hint'>
            Review your changes and click "Save" to apply
          </div>
        </div>
      )}

      {/* Price List Table */}
      <div className='price-list-filters'>
        <Select
          id='payer-filter'
          labelText='Payer Type'
          value={selectedPayerType}
          onChange={(e: any) => setSelectedPayerType(e.target.value)}
          size='md'
        >
          {payerTypes.map((payer: any) => (
            <SelectItem
              key={payer.id}
              value={payer.id.toString()}
              text={payer.payer_code}
            />
          ))}
        </Select>

        {/* <Select
          id='category-filter'
          labelText='Category'
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          size='md'
        >
          <SelectItem value='all' text='All Categories' />
          {categories.map((cat: any) => (
            <SelectItem key={cat} value={cat} text={cat} />
          ))}
        </Select> */}
      </div>
      <div className='price-list-table-container'>
        <DataTable
          rows={filteredItems.map((item: any) => ({ ...item, id: item.id }))}
          headers={headers}
        >
          {({
            rows,
            headers,
            getTableProps,
            getHeaderProps,
            getRowProps,
            getTableContainerProps,
          }) => (
            <TableContainer
              {...getTableContainerProps()}
              className='price-list-table-wrapper'
            >
              <TableToolbar>
                <TableToolbarContent>
                  <TableToolbarSearch
                    persistent
                    placeholder='Search by item name...'
                    onChange={(e: any) => setSearchQuery(e.target.value)}
                    value={searchQuery}
                  />
                </TableToolbarContent>
              </TableToolbar>

              <Table {...getTableProps()} className='price-list-table'>
                <TableHead>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHeader
                        {...getHeaderProps({ header })}
                        key={header.key}
                      >
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length > 0 ? (
                    rows.map((row) => {
                      const item = filteredItems.find(
                        (i: any) => i.id === row.id,
                      );
                      if (!item || !selectedPayer) return null;

                      const key = getEditKey(item.id, selectedPayer.id);
                      const isEditing = editingRows.has(key);
                      const editedPrice = editedPrices.get(key);

                      // ✅ This recalculates automatically when selectedPayer changes
                      const currentPrice = getItemPrice(item, selectedPayer.id);
                      const displayPrice = editedPrice?.price ?? currentPrice;

                      return (
                        <TableRow
                          {...getRowProps({ row })}
                          key={`${row.id}-${selectedPayer.id}`} // ✅ CRITICAL: Include payer in key
                          className={`price-list-table__row ${isEditing ? 'price-list-table__row--editing' : ''} ${editedPrice ? 'price-list-table__row--modified' : ''}`}
                        >
                          <TableCell>
                            <span className='price-list-table__code'>
                              {item.id}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className='price-list-table__name'>
                              {item.item_name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Tag size='sm'>{item.category}</Tag>
                          </TableCell>
                          <TableCell>
                            <div className='price-list-table__base-price'>
                              {formatCurrency(item.base_price)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {isEditing ? (
                              <NumberInput
                                id={`price-${key}`}
                                label=''
                                hideLabel
                                value={displayPrice}
                                min={0}
                                step={100}
                                onChange={(_, { value }) => {
                                  if (value !== undefined && value !== '') {
                                    handlePriceChange(
                                      item.id,
                                      selectedPayer.id,
                                      Number(value),
                                    );
                                  }
                                }}
                                size='sm'
                                className='price-list-table__price-input'
                              />
                            ) : (
                              <div className='price-list-table__price'>
                                {formatCurrency(displayPrice)}
                                {editedPrice && (
                                  <span className='price-list-table__price-badge'>
                                    Modified
                                  </span>
                                )}
                              </div>
                            )}
                            {editedPrice && !isEditing && (
                              <div className='price-list-table__change-preview'>
                                {formatCurrency(currentPrice)} →{' '}
                                {formatCurrency(editedPrice.price)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className='price-list-table__actions'>
                              {isEditing ? (
                                <Button
                                  kind='ghost'
                                  size='sm'
                                  renderIcon={Close}
                                  iconDescription='Cancel'
                                  hasIconOnly
                                  onClick={() =>
                                    handleCancelEdit(item.id, selectedPayer.id)
                                  }
                                />
                              ) : (
                                <Button
                                  kind='ghost'
                                  size='sm'
                                  renderIcon={Edit}
                                  iconDescription='Edit'
                                  hasIconOnly
                                  onClick={() =>
                                    handleEditClick(item.id, selectedPayer.id)
                                  }
                                />
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={headers.length}>
                        <div className='price-list-empty'>
                          <Search size={48} />
                          <p className='price-list-empty__text'>
                            {searchQuery
                              ? 'No items found matching your search'
                              : 'No price items available'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      </div>

      <div className='price-list-pagination'>
        <Pagination
          page={currentPage}
          pageSize={pageSize}
          pageSizes={[200]}
          totalItems={totalItems}
          onChange={({ page, pageSize: newPageSize }) => {
            setCurrentPage(page);
            setPageSize(newPageSize);
          }}
          itemsPerPageText='Items per page:'
        />
      </div>

      {/* Save Confirmation Modal */}
      <Modal
        open={isSaveModalOpen}
        onRequestClose={() => setIsSaveModalOpen(false)}
        modalHeading='Confirm Price Updates'
        primaryButtonText={isSaving ? 'Saving...' : 'Save Changes'}
        secondaryButtonText='Cancel'
        onRequestSubmit={handleConfirmSave}
        primaryButtonDisabled={isSaving}
        danger={false}
        size='md'
      >
        <div className='price-list-modal__content'>
          <p className='price-list-modal__text'>
            You are about to update {editedPrices.size} price
            {editedPrices.size !== 1 ? 's' : ''}. Please review the changes
            below:
          </p>
          <div className='price-list-modal__changes'>
            {Array.from(editedPrices.values()).map((edit) => {
              const item = filteredItems.find(
                (i: any) => i.id === edit.item_id,
              );
              const payer = payerTypes.find((p: any) => p.id === edit.payer_id);
              if (!item || !payer) return null;

              const currentPrice = getItemPrice(item, edit.payer_id);

              return (
                <div
                  key={`${edit.item_id}-${edit.payer_id}`}
                  className='price-list-modal__change-item'
                >
                  <div className='price-list-modal__change-header'>
                    <strong>{item.item_name}</strong>
                    <Tag size='sm'>{payer.payer_code}</Tag>
                  </div>
                  <div className='price-list-modal__change-details'>
                    <span className='price-list-modal__old-price'>
                      {formatCurrency(currentPrice)}
                    </span>
                    <span className='price-list-modal__arrow'>→</span>
                    <span className='price-list-modal__new-price'>
                      {formatCurrency(edit.price)}
                    </span>
                    <span
                      className={`price-list-modal__change-percent ${
                        edit.price > currentPrice
                          ? 'price-list-modal__change-percent--positive'
                          : 'price-list-modal__change-percent--negative'
                      }`}
                    >
                      (
                      {(
                        ((edit.price - currentPrice) / currentPrice) *
                        100
                      ).toFixed(1)}
                      %)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
};
