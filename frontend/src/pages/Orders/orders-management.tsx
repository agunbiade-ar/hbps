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
  Tag,
  Pagination,
  RadioButtonGroup,
  RadioButton,
} from '@carbon/react';
import { ShoppingCart, Receipt, View } from '@carbon/icons-react';
import './orders-management.scss';

// API hooks
import {
  useGetAllOrdersQuery,
  useGetPayerTypesQuery,
  useUpdateOrderMutation,
} from '../../api/Orders';

interface OrderItem {
  concept_name: string;
  concept_id: number;
  category: string;
  quantity: number;
  order_id: number;
}

interface PatientOrder {
  id: number;
  patient_id: number;
  patient_name: string;
  items: OrderItem[];
  status?: 'open' | 'billed' | 'paid' | 'cancelled';
}

export const OrdersManagement = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isGenerateBillModalOpen, setIsGenerateBillModalOpen] = useState(false);
  const [isViewDetailsModalOpen, setIsViewDetailsModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientOrder | null>(
    null,
  );
  const [orderToConvert, setOrderToConvert] = useState<PatientOrder | null>(
    null,
  );
  const [updateOrder, { isLoading }] = useUpdateOrderMutation();

  const [selectedPayerType, setSelectedPayerType] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // Fetch orders
  const ordersQuery = useGetAllOrdersQuery(
    {
      offset: pageSize * (currentPage - 1),
      receipt_number: searchQuery,
      limit: pageSize,
    },
    {
      refetchOnMountOrArgChange: true,
      pollingInterval: 120000,
    },
  );

  // Fetch payer types
  const payerQuery = useGetPayerTypesQuery({});
  const payerTypes = useMemo(() => {
    const payers = payerQuery.data?.payer_types || [];
    return payers;
  }, [payerQuery]);

  // Filter orders
  const filteredPatientOrders = useMemo(() => {
    let orders = ordersQuery.data?.orders || [];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      orders = orders.filter(
        (order) =>
          order.patient_name.toLowerCase().includes(query) ||
          order.id.toString().includes(query) ||
          order.items.some((item) =>
            item.concept_name.toLowerCase().includes(query),
          ),
      );
    }

    return orders;
  }, [ordersQuery, searchQuery]);

  // Pagination
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredPatientOrders.slice(startIndex, endIndex);
  }, [filteredPatientOrders, currentPage, pageSize]);

  // Get category label
  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      lab: 'Laboratory',
      drug: 'Pharmacy',
      procedure: 'Procedure',
      admission: 'Admission',
    };
    return labels[category] || category;
  };

  // Handle generate bill click
  const handleGenerateBillClick = (patientOrder: PatientOrder) => {
    setOrderToConvert(patientOrder);
    setSelectedPayerType('');
    setIsGenerateBillModalOpen(true);
  };

  // Confirm generate bill
  const handleConfirmGenerateBill = async () => {
    if (!orderToConvert) return;

    if (!selectedPayerType) {
      setError('Please select a payer type before generating the bill');
      return;
    }

    try {
      setIsProcessing(true);
      setError('');

      console.log('Generating bill for order ID:', orderToConvert.id);

      const payload = {
        id: orderToConvert.id,
        patient_name: orderToConvert.patient_name,
        patient_id: orderToConvert?.patient_id,
        payer_id: selectedPayerType,
        items: orderToConvert.items,
      };

      await updateOrder({ id: orderToConvert.id, body: payload }).unwrap();

      // await new Promise((resolve) => setTimeout(resolve, 1500));

      setSuccess(
        `Successfully generated bill for ${orderToConvert.patient_name} (Order #${orderToConvert.id})!`,
      );
      setIsGenerateBillModalOpen(false);
      setOrderToConvert(null);
      setSelectedPayerType('');

      ordersQuery.refetch();
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to generate bill: ' + errMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle view patient details
  const handleViewPatientDetails = (patientOrder: PatientOrder) => {
    setSelectedPatient(patientOrder);
    setIsViewDetailsModalOpen(true);
  };

  // Get status tag
  const getStatusTag = (status?: string) => {
    const statusConfig = {
      open: { type: 'blue', label: 'Open' },
      billed: { type: 'green', label: 'Billed' },
      paid: { type: 'green', label: 'Paid' },
      cancelled: { type: 'red', label: 'Cancelled' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      type: 'gray',
      label: status || 'Open',
    };

    return <Tag type={config.type as any}>{config.label}</Tag>;
  };

  // Table headers
  const headers = [
    { key: 'orderId', header: 'Order ID' },
    { key: 'patientName', header: 'Patient Name' },
    { key: 'itemsCount', header: 'Items' },
    { key: 'categories', header: 'Categories' },
    { key: 'status', header: 'Status' },
    { key: 'actions', header: 'Actions' },
  ];

  if (ordersQuery.isLoading) {
    return (
      <div className='orders-management-loading'>
        <Loading description='Loading orders...' withOverlay={false} />
      </div>
    );
  }

  return (
    <div className='orders-management-container'>
      {/* Header */}
      <div className='orders-management-header'>
        <div className='orders-management-header__content'>
          <div className='orders-management-header__icon'>
            <ShoppingCart size={32} />
          </div>
          <div className='orders-management-header__text'>
            <h1 className='orders-management-header__title'>
              Orders Management
            </h1>
            <p className='orders-management-header__subtitle'>
              View and manage patient orders to generate bills
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className='orders-management-notification'>
          <InlineNotification
            kind='error'
            title='Error'
            subtitle={error}
            onClose={() => setError('')}
          />
        </div>
      )}

      {success && (
        <div className='orders-management-notification'>
          <InlineNotification
            kind='success'
            title='Success'
            subtitle={success}
            onClose={() => setSuccess('')}
          />
        </div>
      )}

      {/* Orders Table */}
      <div className='orders-management-table-container'>
        <DataTable
          rows={paginatedOrders.map((order) => ({ ...order, id: order.id }))}
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
              className='orders-management-table-wrapper'
            >
              <TableToolbar>
                <TableToolbarContent>
                  <TableToolbarSearch
                    persistent
                    placeholder='Search by patient name, order ID, or item...'
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    value={searchQuery}
                  />
                </TableToolbarContent>
              </TableToolbar>

              <Table {...getTableProps()} className='orders-management-table'>
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
                      const patientOrder = paginatedOrders.find(
                        (o) => o.id === row.id,
                      );
                      if (!patientOrder) return null;

                      const isOpen =
                        patientOrder.status === 'open' || !patientOrder.status;
                      const categories = [
                        ...new Set(patientOrder.items.map((i) => i.category)),
                      ];

                      return (
                        <TableRow
                          {...getRowProps({ row })}
                          key={row.id}
                          className='orders-management-table__row'
                        >
                          <TableCell>
                            <span className='orders-management-table__order-id'>
                              {patientOrder.id}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className='orders-management-table__patient-name'>
                              {patientOrder.patient_name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className='orders-management-table__total-items'>
                              {patientOrder.items.length} item
                              {patientOrder.items.length !== 1 ? 's' : ''}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className='orders-management-table__categories'>
                              {categories.map((cat) => (
                                <Tag key={cat} size='sm'>
                                  {getCategoryLabel(cat)}
                                </Tag>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusTag(patientOrder.status)}
                          </TableCell>
                          <TableCell>
                            <div className='orders-management-table__actions'>
                              <Button
                                kind='ghost'
                                size='sm'
                                renderIcon={View}
                                iconDescription='View Details'
                                hasIconOnly
                                onClick={() =>
                                  handleViewPatientDetails(patientOrder)
                                }
                              />
                              {isOpen && (
                                <Button
                                  kind='primary'
                                  size='sm'
                                  renderIcon={Receipt}
                                  onClick={() =>
                                    handleGenerateBillClick(patientOrder)
                                  }
                                >
                                  Generate Bill
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={headers.length}>
                        <div className='orders-management-empty'>
                          <ShoppingCart size={48} />
                          <p className='orders-management-empty__text'>
                            {searchQuery
                              ? 'No orders found matching your search'
                              : 'No orders available'}
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

        {/* Pagination */}
        <div className='orders-management-pagination'>
          <Pagination
            page={currentPage}
            pageSize={pageSize}
            pageSizes={[100]}
            totalItems={filteredPatientOrders.length}
            onChange={({ page, pageSize }) => {
              setCurrentPage(page);
              setPageSize(pageSize);
            }}
          />
        </div>
      </div>

      {/* Generate Bill Modal */}
      <Modal
        open={isGenerateBillModalOpen}
        onRequestClose={() => {
          setIsGenerateBillModalOpen(false);
          setOrderToConvert(null);
          setSelectedPayerType('');
        }}
        modalHeading='Generate Bill from Order'
        primaryButtonText={isProcessing ? 'Generating...' : 'Generate Bill'}
        secondaryButtonText='Cancel'
        onRequestSubmit={handleConfirmGenerateBill}
        primaryButtonDisabled={isProcessing || !selectedPayerType}
        danger={false}
        size='md'
      >
        {orderToConvert && (
          <div className='orders-management-modal__content'>
            <p className='orders-management-modal__text'>
              You are about to generate a bill for the following order:
            </p>

            <div className='orders-management-modal__order-summary'>
              <div className='orders-management-modal__order-header'>
                <div>
                  <strong className='orders-management-modal__patient-name'>
                    {orderToConvert.patient_name}
                  </strong>
                  <span className='orders-management-modal__order-id'>
                    Order #{orderToConvert.id}
                  </span>
                </div>
                {getStatusTag(orderToConvert.status)}
              </div>

              <div className='orders-management-modal__items-list'>
                <h3 className='orders-management-modal__items-title'>
                  Items ({orderToConvert.items.length}):
                </h3>
                {orderToConvert.items.map((item, index) => (
                  <div
                    key={`${item.concept_id}-${index}`}
                    className='orders-management-modal__item'
                  >
                    <div className='orders-management-modal__item-header'>
                      <strong>{item.concept_name}</strong>
                      <Tag size='sm'>{getCategoryLabel(item.category)}</Tag>
                    </div>
                    <div className='orders-management-modal__item-details'>
                      <span>Concept ID: {item.concept_id}</span>
                      <span>Quantity: {item.quantity}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payer Type Selection */}
            <div className='orders-management-modal__payer-section'>
              <h3 className='orders-management-modal__payer-title'>
                Select Payer Type{' '}
                <span className='orders-management-modal__required'>*</span>
              </h3>
              <p className='orders-management-modal__payer-subtitle'>
                Choose who will be responsible for payment of this bill
              </p>

              {payerQuery.isLoading ? (
                <div className='orders-management-modal__payer-loading'>
                  <Loading
                    description='Loading payer types...'
                    withOverlay={false}
                    small
                  />
                </div>
              ) : payerTypes.length > 0 ? (
                <RadioButtonGroup
                  name='payer-type-group'
                  valueSelected={selectedPayerType}
                  onChange={(value) => setSelectedPayerType(value as string)}
                  className='orders-management-modal__payer-options'
                >
                  {payerTypes.map((payer: any) => {
                    return (
                      <RadioButton
                        key={payer.id}
                        id={`payer-${payer.id}`}
                        labelText={payer.payer_code}
                        value={payer.id.toString()}
                        className='orders-management-modal__payer-option'
                      />
                    );
                  })}
                </RadioButtonGroup>
              ) : (
                <div className='orders-management-modal__payer-error'>
                  <p>
                    No payer types available. Please contact your administrator.
                  </p>
                </div>
              )}
            </div>

            <div className='orders-management-modal__warning'>
              <p>
                <strong>Note:</strong> This will create a new bill with all
                items from this order. The order status will be updated to
                "Billed".
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* View Patient Details Modal */}
      <Modal
        open={isViewDetailsModalOpen}
        onRequestClose={() => setIsViewDetailsModalOpen(false)}
        modalHeading={`Order Details - ${selectedPatient?.patient_name || ''}`}
        passiveModal
        size='lg'
      >
        {selectedPatient && (
          <div className='orders-management-details'>
            <div className='orders-management-details__header'>
              <div className='orders-management-details__info'>
                <div className='orders-management-details__info-item'>
                  <span className='orders-management-details__info-label'>
                    Order ID:
                  </span>
                  <span className='orders-management-details__info-value'>
                    {selectedPatient.id}
                  </span>
                </div>
                <div className='orders-management-details__info-item'>
                  <span className='orders-management-details__info-label'>
                    Patient Name:
                  </span>
                  <span className='orders-management-details__info-value'>
                    {selectedPatient.patient_name}
                  </span>
                </div>
                <div className='orders-management-details__info-item'>
                  <span className='orders-management-details__info-label'>
                    Total Items:
                  </span>
                  <span className='orders-management-details__info-value'>
                    {selectedPatient.items.length}
                  </span>
                </div>
                <div className='orders-management-details__info-item'>
                  <span className='orders-management-details__info-label'>
                    Status:
                  </span>
                  <span className='orders-management-details__info-value'>
                    {getStatusTag(selectedPatient.status)}
                  </span>
                </div>
              </div>
            </div>

            <div className='orders-management-details__orders'>
              <h3 className='orders-management-details__orders-title'>
                Order Items:
              </h3>
              {selectedPatient.items.map((item, index) => (
                <div
                  key={`${item.concept_id}-${index}`}
                  className='orders-management-details__order'
                >
                  <div className='orders-management-details__order-header'>
                    <div>
                      <strong>{item.concept_name}</strong>
                      <span className='orders-management-details__order-id'>
                        Concept ID: {item.concept_id}
                      </span>
                    </div>
                  </div>
                  <div className='orders-management-details__order-info'>
                    <Tag size='sm'>{getCategoryLabel(item.category)}</Tag>
                    <span>Quantity: {item.quantity}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
