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
  Modal,
  Tag,
  Checkbox,
} from '@carbon/react';
import {
  CheckmarkFilled,
  // Printer,
  ArrowLeft,
  Receipt,
} from '@carbon/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import './bill-approval.scss';
import { useGetBillQuery, useUpdateBillMutation } from '../../api/Bills';

interface BillWithItems {
  bill_id: string;
  patient_name: string;
  bill_status: string;
  total_amount: number;
  bill_items: {
    concept_name: string;
    bill_item_id: number;
    price: number;
    quantity: number;
    status: string;
  }[];
}

const BillDetailApproval = () => {
  const navigate = useNavigate();

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  const location = useLocation();
  const bill = location.state['bill'];

  const billQuery = useGetBillQuery({ id: bill?.id });
  const [updateBill, { isLoading: isUpdating }] = useUpdateBillMutation();
  console.log(billQuery);

  const billItems: BillWithItems = useMemo(() => {
    const billsData = billQuery.data || [];
    return billsData;
  }, [billQuery.data]);

  console.log(billItems);
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
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handle approve/finalize
  const handleApproveClick = () => {
    setIsApproveModalOpen(true);
  };

  const handleItemCheckboxChange = (itemId: number, checked: boolean) => {
    const newSelectedItems = new Set(selectedItems);
    if (checked) {
      newSelectedItems.add(itemId);
    } else {
      newSelectedItems.delete(itemId);
    }
    setSelectedItems(newSelectedItems);
  };

  const handleSelectAllChange = (checked: boolean) => {
    if (checked) {
      const allItemIds = billItems.bill_items.map((item) => item.bill_item_id);
      setSelectedItems(new Set(allItemIds));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleUpdateSelectedClick = () => {
    if (selectedItems.size === 0) {
      setError('Please select at least one item to update.');
      return;
    }
    setIsUpdateModalOpen(true);
  };

  const handleUpdateConfirm = async (item_ids: number[]) => {
    if (item_ids.length === 0) {
      setError('No item was selected!');
      return;
    }

    try {
      setIsProcessing(isUpdating);
      setError('');
      // {"status": "paid", "item_ids": [4518]}
      const payload = {
        id: billItems.bill_id,
        body: {
          status: 'paid',
          item_ids,
        },
      };
      const res = await updateBill(payload);

      setSuccess(`${res.data.message}`);
      setIsUpdateModalOpen(false);
      setSelectedItems(new Set());
      return res;
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : 'Unknown error';
      setError('Failed to update items: ' + errMessage);
    } finally {
      setIsProcessing(isUpdating);
    }
  };

  const handleApproveConfirm = async () => {
    if (!bill) return;

    try {
      setIsProcessing(true);

      setTimeout(() => {
        // setBill({ ...bill, status: 'finalized' });
        setSuccess('Bill has been finalized successfully!');
        setIsApproveModalOpen(false);
        setIsProcessing(false);
      }, 1000);
    } catch (err) {
      setError('Failed to finalize bill. Please try again.');
      setIsProcessing(false);
    }
  };

  // Table headers for bill items
  const headers = [
    { key: 'select', header: 'Select' },
    { key: 'item', header: 'Item Description' },
    { key: 'quantity', header: 'Qty' },
    { key: 'status', header: 'Status' },
    { key: 'unitPrice', header: 'Unit Price' },
    { key: 'total', header: 'Total' },
  ];

  if (billQuery.isLoading) {
    return (
      <div className='bill-detail-loading'>
        <Loading description='Loading bill details...' withOverlay={false} />
      </div>
    );
  }

  if (!bill) {
    return (
      <div className='bill-detail-error'>
        <InlineNotification
          kind='error'
          title='Bill not found'
          subtitle='The requested bill could not be found.'
        />
        <Button
          onClick={() => navigate('/finance/bills')}
          renderIcon={ArrowLeft}
        >
          Back to Bills
        </Button>
      </div>
    );
  }

  return (
    <div className='bill-detail-container'>
      {/* Print-only header */}
      <div className='bill-detail-print-header'>
        <div className='bill-detail-print-logo'>
          <h1>Healthcare Facility Name</h1>
          <p>Address Line 1, City, State</p>
          <p>Phone: +234 XXX XXX XXXX</p>
        </div>
      </div>

      {/* Screen header */}
      <div className='bill-detail-header no-print'>
        <Button
          kind='ghost'
          renderIcon={ArrowLeft}
          onClick={() => navigate('/finance/bills')}
          className='bill-detail-header__back'
        >
          Back to Bills
        </Button>

        <div className='bill-detail-header__actions'>
          {selectedItems.size > 0 && (
            <Button
              kind='primary'
              onClick={handleUpdateSelectedClick}
              className='bill-detail-header__update'
            >
              Update {selectedItems.size} Selected Item
              {selectedItems.size !== 1 ? 's' : ''}
            </Button>
          )}
          {bill.status === 'draft' && (
            <Button
              kind='primary'
              renderIcon={CheckmarkFilled}
              onClick={handleApproveClick}
              className='bill-detail-header__approve'
            >
              Finalize Bill
            </Button>
          )}
          {/* <Button
            kind='tertiary'
            renderIcon={Printer}
            onClick={handlePrint}
            className='bill-detail-header__print'
          >
            Print
          </Button> */}
        </div>
      </div>

      {error && (
        <div className='bill-detail-notification no-print'>
          <InlineNotification
            kind='error'
            title='Error'
            subtitle={error}
            onClose={() => setError('')}
          />
        </div>
      )}

      {success && (
        <div className='bill-detail-notification no-print'>
          <InlineNotification
            kind='success'
            title='Success'
            subtitle={success}
            onClose={() => setSuccess('')}
          // timeout={5000}
          />
        </div>
      )}

      <div className='bill-detail-content'>
        {/* Bill Header Card */}
        <div className='bill-detail-card'>
          <div className='bill-detail-card__header'>
            <div className='bill-detail-card__title-section'>
              <Receipt size={32} className='bill-detail-card__icon' />
              <div>
                <h1 className='bill-detail-card__title'>Bill #{bill.id}</h1>
                <div className='bill-detail-card__status'>
                  <Tag>{billItems.bill_status}</Tag>
                </div>
              </div>
            </div>
          </div>

          <div className='bill-detail-info-grid'>
            <div className='bill-detail-info-item'>
              <span className='bill-detail-info-item__label'>Patient Name</span>
              <span className='bill-detail-info-item__value'>
                {bill.patient_name}
              </span>
            </div>

            {bill.patient_identifier && (
              <div className='bill-detail-info-item'>
                <span className='bill-detail-info-item__label'>Patient ID</span>
                <span className='bill-detail-info-item__value bill-detail-info-item__value--identifier'>
                  {bill.patient_identifier}
                </span>
              </div>
            )}

            <div className='bill-detail-info-item'>
              <span className='bill-detail-info-item__label'>Visit ID</span>
              <span className='bill-detail-info-item__value'>
                {bill.visit_id}
              </span>
            </div>

            <div className='bill-detail-info-item'>
              <span className='bill-detail-info-item__label'>Created On</span>
              <span className='bill-detail-info-item__value'>
                {formatDate(bill.created_at)}
              </span>
            </div>

            {bill.created_by && (
              <div className='bill-detail-info-item'>
                <span className='bill-detail-info-item__label'>Created By</span>
                <span className='bill-detail-info-item__value'>
                  {bill.created_by}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bill Items Table */}
        <div className='bill-detail-items-card'>
          <h2 className='bill-detail-items-card__title'>Bill Items</h2>

          <DataTable
            rows={billItems.bill_items.map((item) => ({
              ...item,
              id: item.bill_item_id.toString(),
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
            }) => (
              <TableContainer
                {...getTableContainerProps()}
                className='bill-detail-items-table'
              >
                <Table {...getTableProps()}>
                  <TableHead>
                    <TableRow>
                      {headers.map((header) => {
                        if (header.key === 'select') {
                          return (
                            <TableHeader
                              {...getHeaderProps({ header })}
                              key={header.key}
                            >
                              {!billItems.bill_items.some(
                                (item) => item.status == 'paid',
                              ) && (
                                  <Checkbox
                                    id='select-all'
                                    labelText=''
                                    checked={
                                      billItems.bill_items.length > 0 &&
                                      selectedItems.size ===
                                      billItems.bill_items.length
                                    }
                                    indeterminate={
                                      selectedItems.size > 0 &&
                                      selectedItems.size <
                                      billItems.bill_items.length
                                    }
                                    onChange={(e) =>
                                      handleSelectAllChange(e.target.checked)
                                    }
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
                    {rows.map((row) => {
                      const item = billItems.bill_items.find((i) => {
                        return i?.['bill_item_id'].toString() === row.id;
                      });
                      if (!item) return null;

                      return (
                        <TableRow {...getRowProps({ row })} key={row.id}>
                          <TableCell>
                            {!(item.status == 'paid') && (
                              <Checkbox
                                id={`item-${item.bill_item_id}`}
                                labelText=''
                                checked={selectedItems.has(item.bill_item_id)}
                                onChange={(e) =>
                                  handleItemCheckboxChange(
                                    item.bill_item_id,
                                    (e.target as HTMLInputElement).checked,
                                  )
                                }
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className='bill-detail-item-name'>
                              {item.concept_name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className='bill-detail-item-quantity'>
                              {item.quantity}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className='bill-detail-item-price'>
                              {item.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className='bill-detail-item-price'>
                              {formatCurrency(item.price)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className='bill-detail-item-total'>
                              {formatCurrency(item.price * item.quantity)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>
        </div>

        {/* Bill Summary */}
        <div className='bill-detail-summary-card'>
          <h2 className='bill-detail-summary-card__title'>Summary</h2>

          <div className='bill-detail-summary-items'>
            <div className='bill-detail-summary-item'>
              <span className='bill-detail-summary-item__label'>Subtotal</span>
              <span className='bill-detail-summary-item__value'>
                {formatCurrency(bill.total_amount)}
              </span>
            </div>

            {bill.discount && bill.discount > 0 && (
              <div className='bill-detail-summary-item'>
                <span className='bill-detail-summary-item__label'>
                  Discount
                </span>
                <span className='bill-detail-summary-item__value bill-detail-summary-item__value--negative'>
                  -{formatCurrency(bill.discount)}
                </span>
              </div>
            )}

            {bill.tax && bill.tax > 0 && (
              <div className='bill-detail-summary-item'>
                <span className='bill-detail-summary-item__label'>Tax</span>
                <span className='bill-detail-summary-item__value'>
                  {formatCurrency(bill.tax)}
                </span>
              </div>
            )}

            <div className='bill-detail-summary-divider'></div>

            <div className='bill-detail-summary-item bill-detail-summary-item--total'>
              <span className='bill-detail-summary-item__label'>
                Total Amount
              </span>
              <span className='bill-detail-summary-item__value'>
                {formatCurrency(bill.total_amount)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Update Selected Items Confirmation Modal */}
      <Modal
        open={isUpdateModalOpen}
        onRequestClose={() => setIsUpdateModalOpen(false)}
        modalHeading='Update Selected Items'
        primaryButtonText={isProcessing ? 'Updating...' : 'Update Status'}
        secondaryButtonText='Cancel'
        onRequestSubmit={() => handleUpdateConfirm([...selectedItems])}
        primaryButtonDisabled={isProcessing}
        danger={false}
        size='sm'
      >
        <p className='bill-detail-modal__text'>
          Are you sure you want to update the status of the selected items?
        </p>
        <div className='bill-detail-modal__details'>
          <p>
            <strong>Bill ID:</strong> #{bill.id}
          </p>
          <p>
            <strong>Items Selected:</strong> {selectedItems.size}
          </p>
          <p>
            <strong>New Status:</strong> Paid
          </p>
        </div>
      </Modal>

      {/* Finalize Confirmation Modal */}
      <Modal
        open={isApproveModalOpen}
        onRequestClose={() => setIsApproveModalOpen(false)}
        modalHeading='Finalize Bill'
        primaryButtonText={isProcessing ? 'Finalizing...' : 'Finalize'}
        secondaryButtonText='Cancel'
        onRequestSubmit={handleApproveConfirm}
        primaryButtonDisabled={isProcessing}
        danger={false}
        size='sm'
      >
        <p className='bill-detail-modal__text'>
          Are you sure you want to finalize this bill? Once finalized, the bill
          cannot be edited.
        </p>
        <div className='bill-detail-modal__details'>
          <p>
            <strong>Bill ID:</strong> #{bill.id}
          </p>
          <p>
            <strong>Patient:</strong> {bill.patient_name}
          </p>
          <p>
            <strong>Total Amount:</strong> {formatCurrency(bill.total_amount)}
          </p>
          {/* <p>
            <strong>Number of Items:</strong> {bill.items.length}
          </p> */}
        </div>
      </Modal>
    </div>
  );
};

export default BillDetailApproval;
