import { useState, useMemo } from 'react';
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
  // TextInput,
  NumberInput,
  Select,
  SelectItem,
  Tag,
  // Tabs,
  // TabList,
  // Tab,
  // TabPanels,
  // TabPanel,
  InlineLoading,
} from '@carbon/react';
import {
  Edit,
  Save,
  Close,
  Money,
  // History,
  Undo,
  // Percentage,
  Search,
  ChartHistogram,
} from '@carbon/icons-react';
import './price-list-management.scss';

// Mock API hooks - replace with actual API
// import { useGetPriceListQuery, useUpdatePricesMutation, useGetPriceHistoryQuery } from '../../api/PriceList';

interface PriceItem {
  id: string;
  item_code: string;
  item_name: string;
  category: string;
  current_price: number;
  previous_price?: number;
  facility_id?: string;
  facility_name?: string;
  last_updated: string;
  updated_by?: string;
  status: 'active' | 'inactive';
}

interface PriceHistory {
  id: string;
  item_id: string;
  old_price: number;
  new_price: number;
  change_date: string;
  changed_by: string;
  reason?: string;
}

interface EditedPrice {
  id: string;
  new_price: number;
  reason?: string;
}

// Mock data
const mockPriceItems: PriceItem[] = [
  {
    id: '1',
    item_code: 'LAB-001',
    item_name: 'Complete Blood Count (CBC)',
    category: 'Laboratory',
    current_price: 5000,
    previous_price: 4500,
    facility_name: 'Main Hospital',
    last_updated: '2024-02-01T10:00:00Z',
    updated_by: 'Admin User',
    status: 'active',
  },
  {
    id: '2',
    item_code: 'RAD-001',
    item_name: 'Chest X-Ray',
    category: 'Radiology',
    current_price: 8000,
    previous_price: 7500,
    facility_name: 'Main Hospital',
    last_updated: '2024-02-05T10:00:00Z',
    updated_by: 'Admin User',
    status: 'active',
  },
  {
    id: '3',
    item_code: 'CONS-001',
    item_name: 'General Consultation',
    category: 'Consultation',
    current_price: 15000,
    previous_price: 12000,
    facility_name: 'Main Hospital',
    last_updated: '2024-01-28T10:00:00Z',
    updated_by: 'Admin User',
    status: 'active',
  },
  {
    id: '4',
    item_code: 'LAB-002',
    item_name: 'Lipid Profile',
    category: 'Laboratory',
    current_price: 7500,
    facility_name: 'Main Hospital',
    last_updated: '2024-01-15T10:00:00Z',
    updated_by: 'Admin User',
    status: 'active',
  },
  {
    id: '5',
    item_code: 'PHARM-001',
    item_name: 'Paracetamol 500mg',
    category: 'Pharmacy',
    current_price: 200,
    facility_name: 'Main Hospital',
    last_updated: '2024-02-10T10:00:00Z',
    updated_by: 'Admin User',
    status: 'active',
  },
];

const mockPriceHistory: PriceHistory[] = [
  {
    id: '1',
    item_id: '1',
    old_price: 4000,
    new_price: 4500,
    change_date: '2024-01-15T10:00:00Z',
    changed_by: 'Admin User',
    reason: 'Annual price adjustment',
  },
  {
    id: '2',
    item_id: '1',
    old_price: 4500,
    new_price: 5000,
    change_date: '2024-02-01T10:00:00Z',
    changed_by: 'Admin User',
    reason: 'Market price increase',
  },
];

export const PriceListManagement = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingRows, setEditingRows] = useState<Set<string>>(new Set());
  const [editedPrices, setEditedPrices] = useState<Map<string, EditedPrice>>(
    new Map(),
  );
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PriceItem | null>(null);
  // const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  // const [bulkAdjustmentType, setBulkAdjustmentType] = useState<
  // 'percentage' | 'fixed'
  // >('percentage');
  // const [bulkAdjustmentValue, setBulkAdjustmentValue] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isSaving, setIsSaving] = useState(false);

  // Mock query - replace with actual API
  const priceListQuery = {
    data: mockPriceItems,
    isLoading: false,
    isError: false,
  };

  const priceHistoryQuery = {
    data: mockPriceHistory,
    isLoading: false,
  };

  // Filter price items
  const filteredItems = useMemo(() => {
    let items = priceListQuery.data || [];

    // Filter by category
    if (selectedCategory !== 'all') {
      items = items.filter((item) => item.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.item_name.toLowerCase().includes(query) ||
          item.item_code.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query),
      );
    }

    return items;
  }, [priceListQuery.data, searchQuery, selectedCategory]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(
      (priceListQuery.data || []).map((item) => item.category),
    );
    return Array.from(cats);
  }, [priceListQuery.data]);

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

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate price change percentage
  const calculatePriceChange = (current: number, previous?: number) => {
    if (!previous) return null;
    const change = ((current - previous) / previous) * 100;
    return change;
  };

  // Handle edit button click
  const handleEditClick = (itemId: string) => {
    const newEditingRows = new Set(editingRows);
    newEditingRows.add(itemId);
    setEditingRows(newEditingRows);
  };

  // Handle cancel edit
  const handleCancelEdit = (itemId: string) => {
    const newEditingRows = new Set(editingRows);
    newEditingRows.delete(itemId);
    setEditingRows(newEditingRows);

    const newEditedPrices = new Map(editedPrices);
    newEditedPrices.delete(itemId);
    setEditedPrices(newEditedPrices);
  };

  // Handle price change
  const handlePriceChange = (
    itemId: string,
    newPrice: number,
    reason?: string,
  ) => {
    const newEditedPrices = new Map(editedPrices);
    newEditedPrices.set(itemId, { id: itemId, new_price: newPrice, reason });
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

      // Mock API call - replace with actual
      const updates = Array.from(editedPrices.values());
      console.log('Saving price updates:', updates);
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setSuccess(
        `Successfully updated ${editedPrices.size} price${editedPrices.size !== 1 ? 's' : ''}!`,
      );
      setEditedPrices(new Map());
      setEditingRows(new Set());
      setIsSaveModalOpen(false);
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to save prices: ' + errMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle view history
  const handleViewHistory = (item: PriceItem) => {
    setSelectedItem(item);
    setIsHistoryModalOpen(true);
  };

  // Handle bulk adjustment
  // const handleApplyBulkAdjustment = () => {
  //   if (bulkAdjustmentValue === 0) {
  //     setError('Please enter an adjustment value');
  //     return;
  //   }

  //   const newEditedPrices = new Map(editedPrices);
  //   const newEditingRows = new Set(editingRows);

  //   filteredItems.forEach((item) => {
  //     let newPrice = item.current_price;

  //     if (bulkAdjustmentType === 'percentage') {
  //       newPrice = item.current_price * (1 + bulkAdjustmentValue / 100);
  //     } else {
  //       newPrice = item.current_price + bulkAdjustmentValue;
  //     }

  //     newPrice = Math.round(newPrice);

  //     newEditedPrices.set(item.id, {
  //       id: item.id,
  //       new_price: newPrice,
  //       reason: `Bulk ${bulkAdjustmentType} adjustment of ${bulkAdjustmentValue}${bulkAdjustmentType === 'percentage' ? '%' : ''}`,
  //     });
  //     newEditingRows.add(item.id);
  //   });

  //   setEditedPrices(newEditedPrices);
  //   setEditingRows(newEditingRows);
  //   setIsBulkModalOpen(false);
  //   setSuccess(
  //     `Bulk adjustment applied to ${filteredItems.length} items. Review and save changes.`,
  //   );
  // };

  // Table headers
  const headers = [
    { key: 'itemCode', header: 'Item Code' },
    { key: 'itemName', header: 'Item Name' },
    { key: 'category', header: 'Category' },
    { key: 'currentPrice', header: 'Current Price' },
    { key: 'change', header: 'Change' },
    { key: 'lastUpdated', header: 'Last Updated' },
    { key: 'actions', header: 'Actions' },
  ];

  if (priceListQuery.isLoading) {
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
              Manage billable item prices and maintain pricing history
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
          {/* <Button
            kind='secondary'
            renderIcon={Percentage}
            onClick={() => setIsBulkModalOpen(true)}
            className='price-list-header__bulk'
          >
            Bulk Adjustment
          </Button> */}
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
      <div className='price-list-table-container'>
        <DataTable
          rows={filteredItems.map((item) => ({ ...item }))}
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
                  <div className='price-list-filters'>
                    <Select
                      id='category-filter'
                      labelText=''
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      size='md'
                    >
                      <SelectItem value='all' text='All' />
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat} text={cat} />
                      ))}
                    </Select>
                  </div>

                  <TableToolbarSearch
                    persistent
                    placeholder='Search by item name, code, or category'
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
                      const item = filteredItems.find((i) => i.id === row.id);
                      if (!item) return null;

                      const isEditing = editingRows.has(item.id);
                      const editedPrice = editedPrices.get(item.id);
                      const displayPrice = editedPrice
                        ? editedPrice.new_price
                        : item.current_price;
                      const priceChange = calculatePriceChange(
                        item.current_price,
                        item.previous_price,
                      );

                      return (
                        <TableRow
                          {...getRowProps({ row })}
                          key={row.id}
                          className={`price-list-table__row ${isEditing ? 'price-list-table__row--editing' : ''} ${editedPrice ? 'price-list-table__row--modified' : ''}`}
                        >
                          <TableCell>
                            <span className='price-list-table__code'>
                              {item.item_code}
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
                            {isEditing ? (
                              <NumberInput
                                id={`price-${item.id}`}
                                label=''
                                hideLabel
                                value={displayPrice}
                                min={0}
                                step={100}
                                onChange={(_, { value }) => {
                                  if (value !== undefined && value !== '') {
                                    handlePriceChange(item.id, Number(value));
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
                          </TableCell>
                          <TableCell>
                            {priceChange !== null && (
                              <div
                                className={`price-list-table__change ${priceChange > 0 ? 'price-list-table__change--positive' : 'price-list-table__change--negative'}`}
                              >
                                {priceChange > 0 ? '+' : ''}
                                {priceChange.toFixed(1)}%
                              </div>
                            )}
                            {editedPrice && (
                              <div className='price-list-table__change-preview'>
                                {formatCurrency(item.current_price)} →{' '}
                                {formatCurrency(editedPrice.new_price)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className='price-list-table__updated'>
                              {formatDate(item.last_updated)}
                            </div>
                            {item.updated_by && (
                              <div className='price-list-table__updated-by'>
                                by {item.updated_by}
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
                                  onClick={() => handleCancelEdit(item.id)}
                                />
                              ) : (
                                <Button
                                  kind='ghost'
                                  size='sm'
                                  renderIcon={Edit}
                                  iconDescription='Edit'
                                  hasIconOnly
                                  onClick={() => handleEditClick(item.id)}
                                />
                              )}
                              <Button
                                kind='ghost'
                                size='sm'
                                renderIcon={ChartHistogram}
                                iconDescription='View History'
                                hasIconOnly
                                onClick={() => handleViewHistory(item)}
                              />
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
              const item = filteredItems.find((i) => i.id === edit.id);
              if (!item) return null;

              return (
                <div key={edit.id} className='price-list-modal__change-item'>
                  <div className='price-list-modal__change-header'>
                    <strong>{item.item_name}</strong>
                    <span className='price-list-modal__change-code'>
                      {item.item_code}
                    </span>
                  </div>
                  <div className='price-list-modal__change-details'>
                    <span className='price-list-modal__old-price'>
                      {formatCurrency(item.current_price)}
                    </span>
                    <span className='price-list-modal__arrow'>→</span>
                    <span className='price-list-modal__new-price'>
                      {formatCurrency(edit.new_price)}
                    </span>
                    <span
                      className={`price-list-modal__change-percent ${edit.new_price > item.current_price
                        ? 'price-list-modal__change-percent--positive'
                        : 'price-list-modal__change-percent--negative'
                        }`}
                    >
                      (
                      {(
                        ((edit.new_price - item.current_price) /
                          item.current_price) *
                        100
                      ).toFixed(1)}
                      %)
                    </span>
                  </div>
                  {edit.reason && (
                    <div className='price-list-modal__reason'>
                      Reason: {edit.reason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* Price History Modal */}
      <Modal
        open={isHistoryModalOpen}
        onRequestClose={() => setIsHistoryModalOpen(false)}
        modalHeading={`Price History - ${selectedItem?.item_name || ''}`}
        passiveModal
        size='lg'
      >
        <div className='price-list-history'>
          <div className='price-list-history__current'>
            <div className='price-list-history__current-label'>
              Current Price
            </div>
            <div className='price-list-history__current-value'>
              {selectedItem && formatCurrency(selectedItem.current_price)}
            </div>
          </div>

          {priceHistoryQuery.isLoading ? (
            <InlineLoading description='Loading history...' />
          ) : (
            <div className='price-list-history__timeline'>
              {priceHistoryQuery.data
                .filter((h) => h.item_id === selectedItem?.id)
                .map((history) => (
                  <div key={history.id} className='price-list-history__entry'>
                    <div className='price-list-history__entry-date'>
                      {formatDate(history.change_date)}
                    </div>
                    <div className='price-list-history__entry-content'>
                      <div className='price-list-history__entry-change'>
                        <span className='price-list-history__entry-old'>
                          {formatCurrency(history.old_price)}
                        </span>
                        <span className='price-list-history__entry-arrow'>
                          →
                        </span>
                        <span className='price-list-history__entry-new'>
                          {formatCurrency(history.new_price)}
                        </span>
                      </div>
                      <div className='price-list-history__entry-meta'>
                        Changed by {history.changed_by}
                      </div>
                      {history.reason && (
                        <div className='price-list-history__entry-reason'>
                          {history.reason}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Bulk Adjustment Modal */}
      {/* <Modal
        open={isBulkModalOpen}
        onRequestClose={() => setIsBulkModalOpen(false)}
        modalHeading='Bulk Price Adjustment'
        primaryButtonText='Apply Adjustment'
        secondaryButtonText='Cancel'
        onRequestSubmit={handleApplyBulkAdjustment}
        danger={false}
        size='sm'
      >
        <div className='price-list-bulk'>
          <p className='price-list-bulk__text'>
            Apply a bulk price adjustment to{' '}
            {selectedCategory === 'all' ? 'all items' : selectedCategory}. This
            will update {filteredItems.length} item
            {filteredItems.length !== 1 ? 's' : ''}.
          </p>

          <Select
            id='adjustment-type'
            labelText='Adjustment Type'
            value={bulkAdjustmentType}
            onChange={(e) =>
              setBulkAdjustmentType(e.target.value as 'percentage' | 'fixed')
            }
          >
            <SelectItem value='percentage' text='Percentage (%)' />
            <SelectItem value='fixed' text='Fixed Amount (₦)' />
          </Select>

          <NumberInput
            id='adjustment-value'
            label={
              bulkAdjustmentType === 'percentage'
                ? 'Adjustment Percentage'
                : 'Adjustment Amount'
            }
            value={bulkAdjustmentValue}
            onChange={(e, { value }) => {
              if (value !== undefined && value !== '') {
                setBulkAdjustmentValue(Number(value));
              }
            }}
            step={bulkAdjustmentType === 'percentage' ? 1 : 100}
            helperText={
              bulkAdjustmentType === 'percentage'
                ? 'Use negative values to decrease prices'
                : 'Use negative values to decrease prices'
            }
          />
        </div>
      </Modal> */}
    </div>
  );
};
