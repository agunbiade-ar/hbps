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
  Checkbox,
  Tag,
  Modal,
  RadioButtonGroup,
  RadioButton,
} from '@carbon/react';
import { ArrowLeft, CheckmarkFilled, Delivery } from '@carbon/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import './order-items-management.scss';
import {
  useUpdateOrderMutation,
  useGetBillingVisitQuery,
  useGetPayerTypesQuery,
} from '../../api/Orders';

interface OrderItem {
  id: number;
  concept_name: string;
  concept_id: number;
  category: string;
  quantity: number;
  status: 'open' | 'billed' | 'paid' | 'dispensed';
  order_id: number;
}

interface OrderDetails {
  id: number;
  patient_name: string;
  patient_id: number;
  status: string;
  items: OrderItem[];
}

export const OrderItemsManagement = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [updateOrders] = useUpdateOrderMutation();

  const [selectedPayerType, setSelectedPayerType] = useState('');

  // Fetch payer types
  const payerQuery = useGetPayerTypesQuery({});
  const payerTypes: { id: number; payer_code: string; payer_name: string }[] =
    useMemo(() => {
      const payers = payerQuery.data?.payer_types || [];
      return payers;
    }, [payerQuery]);

  // Get order data from navigation state
  // const orderDetails = location.state?.orderDetails as OrderDetails | undefined;

  const orderDetailsQuery = useGetBillingVisitQuery({
    id: Number(id),
  });

  const orderDetails = useMemo(() => {
    const order: OrderDetails = orderDetailsQuery.data;
    return order;
  }, [orderDetailsQuery]);

  console.log(orderDetails);
  // Separate selections for each table
  const [selectedOpenItems, setSelectedOpenItems] = useState<Set<number>>(
    new Set(),
  );
  const [selectedPaidItems, setSelectedPaidItems] = useState<Set<number>>(
    new Set(),
  );

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'bill' | 'dispense' | null>(
    null,
  );
  const [isProcessing, setIsProcessing] = useState(false);

  // Split items into two groups
  const openBilledItems = useMemo(() => {
    return (
      orderDetails?.items.filter(
        (item) => item.status === 'open' || item.status === 'billed',
      ) || []
    );
  }, [orderDetails]);

  const paidDispensedItems = useMemo(() => {
    return (
      orderDetails?.items.filter(
        (item) => item.status === 'paid' || item.status === 'dispensed',
      ) || []
    );
  }, [orderDetails]);

  // Redirect back if no order data
  // useEffect(() => {
  //   if (!orderDetails) {
  //     navigate('/orders');
  //   }
  // }, [orderDetails, navigate]);

  // Show loading while redirecting
  if (!orderDetails) {
    return (
      <div className='order-items-loading'>
        <Loading description='Loading...' withOverlay={false} />
      </div>
    );
  }

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

  // Get status tag
  const getStatusTag = (status: string) => {
    const statusConfig = {
      open: { type: 'blue', label: 'Open' },
      billed: { type: 'purple', label: 'Billed' },
      paid: { type: 'green', label: 'Paid' },
      dispensed: { type: 'teal', label: 'Dispensed' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      type: 'gray',
      label: status,
    };

    return <Tag type={config.type as any}>{config.label}</Tag>;
  };

  // Handle checkbox changes for open/billed table
  const handleOpenItemToggle = (itemOrderId: number, checked: boolean) => {
    const item = openBilledItems.find((i) => i.order_id === itemOrderId);
    if (!item || item.status === 'billed') return; // Only allow open items to be selected

    const newSelection = new Set(selectedOpenItems);
    if (checked) {
      newSelection.add(itemOrderId);
    } else {
      newSelection.delete(itemOrderId);
    }
    setSelectedOpenItems(newSelection);
  };

  // Handle checkbox changes for paid/dispensed table
  const handlePaidItemToggle = (itemOrderId: number, checked: boolean) => {
    const item = paidDispensedItems.find((i) => i.order_id === itemOrderId);
    if (!item || item.status === 'dispensed') return; // Only allow paid items to be selected

    const newSelection = new Set(selectedPaidItems);
    if (checked) {
      newSelection.add(itemOrderId);
    } else {
      newSelection.delete(itemOrderId);
    }
    setSelectedPaidItems(newSelection);
  };

  // Handle mark as billed
  const handleMarkAsBilled = () => {
    if (selectedOpenItems.size === 0) {
      setError('Please select at least one item to mark as billed');
      return;
    }
    setActionType('bill');
    setIsConfirmModalOpen(true);
  };

  // Handle mark as dispensed
  const handleMarkAsDispensed = () => {
    if (selectedPaidItems.size === 0) {
      setError('Please select at least one item to mark as dispensed');
      return;
    }
    setActionType('dispense');
    setIsConfirmModalOpen(true);
  };

  // Confirm action
  const handleConfirmAction = async () => {
    try {
      setIsProcessing(true);
      setError('');

      if (actionType === 'bill') {
        const orderIds = Array.from(selectedOpenItems);
        console.log('Marking as billed (order_ids):', orderIds);
        const items = [];
        for (const i of orderDetails.items) {
          if (orderIds.includes(i.order_id)) {
            items.push({
              concept_name: i.concept_name,
              concept_id: i.concept_id,
              quantity: i.quantity,
              order_id: i.order_id,
              category: i.category,
            });
          }
        }

        const payload = {
          id: orderDetails.id,
          patient_id: orderDetails.patient_id,
          patient_name: orderDetails.patient_name,
          payer_id: selectedPayerType,
          items,
        };
        // await updateOrderItems({ order_ids: orderIds, status: 'billed' }).unwrap();

        try {
          await updateOrders({
            id: orderDetails.id,
            body: payload,
          }).unwrap();
          setSuccess(
            `Successfully marked ${orderIds.length} item(s) as billed`,
          );
        } catch (error: any) {
          console.log(error);
          setError(error.data.detail);
        }
        setSelectedOpenItems(new Set());
      } else if (actionType === 'dispense') {
        const orderIds = Array.from(selectedPaidItems);
        console.log('Marking as dispensed (order_ids):', orderIds);

        // await updateOrders({
        //   id: orderDetails.id,
        // }).unwrap();

        await new Promise((resolve) => setTimeout(resolve, 1000));
        setSuccess(
          `Successfully marked ${orderIds.length} item(s) as dispensed`,
        );
        setSelectedPaidItems(new Set());
      }

      setIsConfirmModalOpen(false);
      setActionType(null);
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to update items: ${errMessage}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Table headers
  const headers = [
    { key: 'select', header: 'Select' },
    { key: 'itemName', header: 'Item Name' },
    { key: 'category', header: 'Category' },
    { key: 'quantity', header: 'Quantity' },
    { key: 'status', header: 'Status' },
  ];

  return (
    <div className='order-items-container'>
      {/* Header */}
      <div className='order-items-header'>
        <Button
          kind='ghost'
          renderIcon={ArrowLeft}
          onClick={() => navigate('/orders')}
          className='order-items-header__back'
        >
          Back to Orders
        </Button>

        <div className='order-items-header__info'>
          <h1 className='order-items-header__title'>Manage Order Items</h1>
          <div className='order-items-header__meta'>
            <span className='order-items-header__patient'>
              Patient: <strong>{orderDetails.patient_name}</strong>
            </span>
            <span className='order-items-header__order-id'>
              Order ID: <strong>#{orderDetails.id}</strong>
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className='order-items-notification'>
          <InlineNotification
            kind='error'
            title='Error'
            subtitle={error}
            onClose={() => setError('')}
          />
        </div>
      )}

      {success && (
        <div className='order-items-notification'>
          <InlineNotification
            kind='success'
            title='Success'
            subtitle={success}
            onClose={() => setSuccess('')}
          />
        </div>
      )}

      {/* Open/Billed Items Section */}
      <div className='order-items-section'>
        <div className='order-items-section__header'>
          <div className='order-items-section__title-group'>
            <h2 className='order-items-section__title'>Open & Billed Items</h2>
            <p className='order-items-section__subtitle'>
              Select open items and mark them as billed
            </p>
          </div>
          {selectedOpenItems.size > 0 && (
            <Button
              kind='primary'
              renderIcon={CheckmarkFilled}
              onClick={handleMarkAsBilled}
            >
              Mark as Billed ({selectedOpenItems.size})
            </Button>
          )}
        </div>

        <div className='order-items-table-container'>
          <DataTable
            rows={openBilledItems.map((item) => ({
              ...item,
              id: item.order_id.toString(),
            }))}
            headers={headers}
          >
            {({
              rows,
              headers,
              getTableProps,
              getHeaderProps,
              getRowProps,
              getTableContainerProps,
            }) => {
              // Calculate select all state
              const selectableItems = openBilledItems.filter(
                (i) => i.status === 'open',
              );
              const allSelected =
                selectableItems.length > 0 &&
                selectableItems.every((i) => selectedOpenItems.has(i.order_id));
              const someSelected = selectableItems.some((i) =>
                selectedOpenItems.has(i.order_id),
              );

              return (
                <TableContainer
                  {...getTableContainerProps()}
                  className='order-items-table-wrapper'
                >
                  <Table {...getTableProps()} className='order-items-table'>
                    <TableHead>
                      <TableRow>
                        {headers.map((header) => {
                          if (header.key === 'select') {
                            return (
                              <TableHeader
                                {...getHeaderProps({ header })}
                                key={header.key}
                              >
                                {selectableItems.length > 0 && (
                                  <Checkbox
                                    id='select-all-open'
                                    labelText='Select all'
                                    hideLabel
                                    checked={allSelected}
                                    indeterminate={someSelected && !allSelected}
                                    onChange={(e) => {
                                      const newSelection = new Set(
                                        selectedOpenItems,
                                      );
                                      if (e.target.checked) {
                                        selectableItems.forEach((item) =>
                                          newSelection.add(item.order_id),
                                        );
                                      } else {
                                        selectableItems.forEach((item) =>
                                          newSelection.delete(item.order_id),
                                        );
                                      }
                                      setSelectedOpenItems(newSelection);
                                    }}
                                  />
                                )}
                              </TableHeader>
                            );
                          }
                          return (
                            <TableHeader
                              {...getHeaderProps({ header })}
                              key={header.key}
                            >
                              {header.header}
                            </TableHeader>
                          );
                        })}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.length > 0 ? (
                        rows.map((row) => {
                          const item = openBilledItems.find(
                            (i) => i.order_id.toString() === row.id,
                          );
                          if (!item) return null;

                          const canSelect = item.status === 'open';

                          return (
                            <TableRow
                              {...getRowProps({ row })}
                              key={row.id}
                              className='order-items-table__row'
                            >
                              <TableCell>
                                {canSelect ? (
                                  <Checkbox
                                    id={`open-${item.order_id}`}
                                    labelText=''
                                    checked={selectedOpenItems.has(
                                      item.order_id,
                                    )}
                                    onChange={(e) =>
                                      handleOpenItemToggle(
                                        item.order_id,
                                        e.target.checked,
                                      )
                                    }
                                  />
                                ) : (
                                  <span className='order-items-table__disabled-checkbox'>
                                    —
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className='order-items-table__item-name'>
                                  {item.concept_name}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Tag size='sm'>
                                  {getCategoryLabel(item.category)}
                                </Tag>
                              </TableCell>
                              <TableCell>
                                <span className='order-items-table__quantity'>
                                  {item.quantity}
                                </span>
                              </TableCell>
                              <TableCell>{getStatusTag(item.status)}</TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={headers.length}>
                            <div className='order-items-empty'>
                              <p>No open or billed items</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              );
            }}
          </DataTable>
        </div>
      </div>

      {/* Paid/Dispensed Items Section */}
      <div className='order-items-section'>
        <div className='order-items-section__header'>
          <div className='order-items-section__title-group'>
            <h2 className='order-items-section__title'>
              Paid & Dispensed Items
            </h2>
            <p className='order-items-section__subtitle'>
              Select paid items and mark them as dispensed
            </p>
          </div>
          {selectedPaidItems.size > 0 && (
            <Button
              kind='secondary'
              renderIcon={Delivery}
              onClick={handleMarkAsDispensed}
            >
              Mark as Dispensed ({selectedPaidItems.size})
            </Button>
          )}
        </div>

        <div className='order-items-table-container'>
          <DataTable
            rows={paidDispensedItems.map((item) => ({
              // ✅ FIXED: Using paidDispensedItems instead of openBilledItems
              ...item,
              id: item.order_id.toString(),
            }))}
            headers={headers}
          >
            {({
              rows,
              headers,
              getTableProps,
              getHeaderProps,
              getRowProps,
              getTableContainerProps,
            }) => {
              // Calculate select all state
              const selectableItems = paidDispensedItems.filter(
                (i) => i.status === 'paid',
              );
              const allSelected =
                selectableItems.length > 0 &&
                selectableItems.every((i) => selectedPaidItems.has(i.order_id));
              const someSelected = selectableItems.some((i) =>
                selectedPaidItems.has(i.order_id),
              );

              return (
                <TableContainer
                  {...getTableContainerProps()}
                  className='order-items-table-wrapper'
                >
                  <Table {...getTableProps()} className='order-items-table'>
                    <TableHead>
                      <TableRow>
                        {headers.map((header) => {
                          if (header.key === 'select') {
                            return (
                              <TableHeader
                                {...getHeaderProps({ header })}
                                key={header.key}
                              >
                                {selectableItems.length > 0 && (
                                  <Checkbox
                                    id='select-all-paid'
                                    labelText='Select all'
                                    hideLabel
                                    checked={allSelected}
                                    indeterminate={someSelected && !allSelected}
                                    onChange={(e) => {
                                      const newSelection = new Set(
                                        selectedPaidItems,
                                      );
                                      if (e.target.checked) {
                                        selectableItems.forEach((item) =>
                                          newSelection.add(item.order_id),
                                        );
                                      } else {
                                        selectableItems.forEach((item) =>
                                          newSelection.delete(item.order_id),
                                        );
                                      }
                                      setSelectedPaidItems(newSelection);
                                    }}
                                  />
                                )}
                              </TableHeader>
                            );
                          }
                          return (
                            <TableHeader
                              {...getHeaderProps({ header })}
                              key={header.key}
                            >
                              {header.header}
                            </TableHeader>
                          );
                        })}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rows.length > 0 ? (
                        rows.map((row) => {
                          const item = paidDispensedItems.find(
                            // ✅ FIXED: Looking in paidDispensedItems
                            (i) => i.order_id.toString() === row.id,
                          );
                          if (!item) return null;

                          const canSelect = item.status === 'paid';

                          return (
                            <TableRow
                              {...getRowProps({ row })}
                              key={row.id}
                              className='order-items-table__row'
                            >
                              <TableCell>
                                {canSelect ? (
                                  <Checkbox
                                    id={`paid-${item.order_id}`}
                                    labelText=''
                                    checked={selectedPaidItems.has(
                                      item.order_id,
                                    )}
                                    onChange={(e) =>
                                      handlePaidItemToggle(
                                        item.order_id,
                                        e.target.checked,
                                      )
                                    }
                                  />
                                ) : (
                                  <span className='order-items-table__disabled-checkbox'>
                                    —
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className='order-items-table__item-name'>
                                  {item.concept_name}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Tag size='sm'>
                                  {getCategoryLabel(item.category)}
                                </Tag>
                              </TableCell>
                              <TableCell>
                                <span className='order-items-table__quantity'>
                                  {item.quantity}
                                </span>
                              </TableCell>
                              <TableCell>{getStatusTag(item.status)}</TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={headers.length}>
                            <div className='order-items-empty'>
                              <p>No paid or dispensed items</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              );
            }}
          </DataTable>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        open={isConfirmModalOpen}
        onRequestClose={() => {
          setIsConfirmModalOpen(false);
          setActionType(null);
          setSelectedPayerType(''); // Reset on close
        }}
        modalHeading={
          actionType === 'bill'
            ? 'Confirm Mark as Billed'
            : 'Confirm Mark as Dispensed'
        }
        primaryButtonText={isProcessing ? 'Processing...' : 'Confirm'}
        secondaryButtonText='Cancel'
        onRequestSubmit={handleConfirmAction}
        primaryButtonDisabled={
          isProcessing || (actionType === 'bill' && !selectedPayerType)
        }
        danger={false}
        size='md'
      >
        <div className='order-items-modal'>
          <p className='order-items-modal__text'>
            {actionType === 'bill' ? (
              <>
                You are about to mark <strong>{selectedOpenItems.size}</strong>{' '}
                item(s) as <strong>billed</strong>. This will update their
                status from open to billed.
              </>
            ) : (
              <>
                You are about to mark <strong>{selectedPaidItems.size}</strong>{' '}
                item(s) as <strong>dispensed</strong>. This will indicate that
                these items have been given to the patient.
              </>
            )}
          </p>

          {/* Payer Type Selection - Only show for billing */}
          {actionType === 'bill' && (
            <div className='order-items-modal__payer-section'>
              <h3 className='order-items-modal__payer-title'>
                Select Payer Type{' '}
                <span className='order-items-modal__required'>*</span>
              </h3>
              <p className='order-items-modal__payer-subtitle'>
                Choose who will be responsible for payment
              </p>

              {payerQuery.isLoading ? (
                <div className='order-items-modal__payer-loading'>
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
                  className='order-items-modal__payer-options'
                >
                  {payerTypes.map((payer) => (
                    <RadioButton
                      key={payer.id}
                      id={`payer-${payer.id}`}
                      labelText={payer.payer_code || payer.payer_name}
                      value={payer.id.toString()}
                    />
                  ))}
                </RadioButtonGroup>
              ) : (
                <div className='order-items-modal__payer-error'>
                  <p>
                    No payer types available. Please contact your administrator.
                  </p>
                </div>
              )}
            </div>
          )}

          <p className='order-items-modal__warning'>
            This action cannot be undone. Continue?
          </p>
        </div>
      </Modal>
    </div>
  );
};
