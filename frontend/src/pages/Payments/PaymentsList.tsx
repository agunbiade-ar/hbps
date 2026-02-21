import { useState, useMemo } from 'react';
import {
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
  Button,
  Pagination,
  InlineNotification,
  DatePicker,
  DatePickerInput,
  Toggle,
} from '@carbon/react';
import { Wallet, Printer } from '@carbon/icons-react';
import './payments-list.scss';
import { useGetAllPaymentsQuery } from '../../api/Payments';
import { useGetFacilityQuery } from '../../api/Facility';
import { format } from 'date-fns';

export interface BillItem {
  description: string;
  unit_price: number;
  quantity: number;
  category: string;
}

export interface Payment {
  id: string;
  receipt_number: string;
  amount: number;
  patient_name: string;
  cashier_name: string;
  bill_id: string;
  created_at: string;
  updated_at: string;
  bill_items?: BillItem[];
}

const PaymentsList = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  // Date filter state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [todayOnly, setTodayOnly] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  const facilityQuery = useGetFacilityQuery({});
  // console.log(facilityQuery.data);
  const paymentsQuery = useGetAllPaymentsQuery(
    {
      offset: pageSize * (currentPage - 1),
      receipt_number: searchQuery,
      limit: pageSize,
      start_date: todayOnly ? '' : startDate,
      end_date: todayOnly ? '' : endDate,
      today: todayOnly,
    },
    {
      refetchOnMountOrArgChange: true,
      pollingInterval: 120000,
    },
  );

  // Handle search and update filtered payments based on query data
  const filteredPayments = useMemo(() => {
    const paymentsData = paymentsQuery.data?.payments || [];

    if (!searchQuery.trim()) {
      return paymentsData;
    }

    const query = searchQuery.toLowerCase();
    return paymentsData.filter(
      (payment: Payment) =>
        payment.receipt_number.toLowerCase().includes(query) ||
        payment.patient_name.toLowerCase().includes(query),
    );
  }, [searchQuery, paymentsQuery.data]);

  // Pagination calculations
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedPayments = filteredPayments.slice(startIndex, endIndex);
  const totalItems = filteredPayments.length;

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
    });
  };

  // Format date and time for receipt
  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handle today toggle change
  const handleTodayToggle = (checked: boolean) => {
    setTodayOnly(checked);
    if (checked) {
      // Clear date range when today is enabled
      setStartDate('');
      setEndDate('');
    }
    // Reset to first page when filter changes
    setCurrentPage(1);
  };

  // Handle date range change
  const handleDateRangeChange = (dates: Date[]) => {
    if (dates.length === 2) {
      setStartDate(format(dates[0], 'yyyy-MM-dd'));
      setEndDate(format(dates[1], 'yyyy-MM-dd'));
      setTodayOnly(false); // Disable today filter when date range is selected
      setCurrentPage(1); // Reset to first page
    }
  };

  // Clear date filters
  const clearDateFilters = () => {
    setStartDate('');
    setEndDate('');
    setTodayOnly(false);
    setCurrentPage(1);
  };

  // Handle print receipt
  const handlePrintReceipt = (payment: Payment, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click from triggering

    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=400,height=600');

    if (!printWindow) {
      setError('Please allow pop-ups to print receipts');
      return;
    }

    // Generate receipt HTML
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Receipt - ${payment.receipt_number}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            padding: 10px;
          }

          .receipt {
            max-width: 300px;
            margin: 0 auto;
          }

          .receipt-header {
            text-align: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px dashed #000;
          }

          .receipt-header h1 {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 5px;
          }

          .receipt-header p {
            font-size: 11px;
            margin: 2px 0;
          }

          .receipt-title {
            text-align: center;
            font-size: 14px;
            font-weight: bold;
            margin: 10px 0;
            text-transform: uppercase;
          }

          .receipt-details {
            margin: 15px 0;
          }

          .receipt-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-size: 12px;
          }

          .receipt-row.label {
            font-weight: bold;
          }

          .receipt-divider {
            border-top: 1px dashed #000;
            margin: 10px 0;
          }

          .receipt-total {
            margin: 15px 0;
            padding: 10px 0;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
          }

          .receipt-total-row {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            font-weight: bold;
          }

          .receipt-footer {
            text-align: center;
            margin-top: 15px;
            font-size: 11px;
            padding-top: 10px;
            border-top: 1px dashed #000;
          }

          .receipt-footer p {
            margin: 3px 0;
          }

          @media print {
            body {
              margin: 0;
              padding: 0;
            }

            * {
              box-shadow: none !important;
            }

            .receipt {
              width: 58mm;
              margin: 0 auto;
            }

            @page {
              size: 58mm auto;
              margin: 0;
            }
          }

          @media print and (min-width: 80mm) {
            body {
              margin: 0;
              font-size: 12px;
              font-family: monospace;
            }

            .receipt {
              width: 72mm;
              padding: 10px;
            }

            @page {
              size: 80mm auto;
              margin: 0;
            }
          }

          @media screen {
            body {
              background: #f0f0f0;
              padding: 20px;
            }

            .receipt {
              background: white;
              padding: 20px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="receipt-header">
            <h1>${facilityQuery.data?.facility_name}</h1>
            <p>${facilityQuery.data?.street ?? ''}</p>
            <p>${facilityQuery.data?.state}</p>
            <p>${facilityQuery.data?.phone_no}</p>
          </div>

          <div class="receipt-title">PAYMENT RECEIPT</div>

          <div class="receipt-details">
            <div class="receipt-row">
              <span>Receipt No:</span>
              <span><strong>${payment.receipt_number}</strong></span>
            </div>
            <div class="receipt-row">
              <span>Date:</span>
              <span>${formatDateTime(payment.created_at)}</span>
            </div>
            <div class="receipt-row">
              <span>Bill ID:</span>
              <span>${payment.bill_id}</span>
            </div>
          </div>

          <div class="receipt-divider"></div>

          <div class="receipt-details">
            <div class="receipt-row">
              <span>Patient Name:</span>
            </div>
            <div class="receipt-row">
              <span><strong>${payment.patient_name}</strong></span>
            </div>
          </div>

          <div class="receipt-divider"></div>
         
          <div class="receipt-details">
            <div class="receipt-row">
              <span>Cashier:</span>
            </div>
            <div class="receipt-row">
              <span><strong>${payment.cashier_name}</strong></span>
            </div>
          </div>

          <div class="receipt-divider"></div>

          <div class="receipt-items" style="margin: 15px 0;">
            <div class="receipt-row label" style="font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 5px; margin-bottom: 10px;">
              <span style="flex: 1;">Description</span>
              <span style="flex: 0.4; text-align: right;">Qty</span>
              <span style="flex: 0.6; text-align: right;">Amount</span>
            </div>
            ${
              payment.bill_items && payment.bill_items.length > 0
                ? payment.bill_items
                    .map(
                      (item) => `
              <div class="receipt-row" style="font-size: 11px; padding-bottom: 8px;">
                <span style="flex: 1;">${item.description}</span>
                <span style="flex: 0.4; text-align: right;">${item.quantity}</span>
                <span style="flex: 0.6; text-align: right;">${formatCurrency(item.unit_price * item.quantity)}</span>
              </div>
            `,
                    )
                    .join('')
                : '<div class="receipt-row" style="text-align: center; padding: 10px 0;"><span>No items</span></div>'
            }
            <div class="receipt-row" style="font-size: 11px; color: #666; margin-top: 10px;">
              <span style="flex: 1; text-align: right;">Subtotal:</span>
              <span style="flex: 0.6; text-align: right;">${formatCurrency(payment.amount)}</span>
            </div>
          </div>

          <div class="receipt-divider"></div>

          <div class="receipt-total">
            <div class="receipt-total-row">
              <span>AMOUNT PAID:</span>
              <span>${formatCurrency(payment.amount)}</span>
            </div>
          </div>

          <div class="receipt-footer">
            <p>Thank you for your payment!</p>
            <p>This is a computer-generated receipt.</p>
            <p>Please retain for your records.</p>
          </div>
        </div>

        <script>
          // Auto-print when window loads
          window.onload = function() {
            window.print();
            // Optional: Close window after printing
            // window.onafterprint = function() {
            //   window.close();
            // };
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(receiptHTML);
    printWindow.document.close();
  };

  // Table headers - updated to include action column
  const headers = [
    { key: 'receiptNumber', header: 'Receipt Number' },
    { key: 'patientName', header: 'Patient Name' },
    { key: 'cashierName', header: 'Cashier' },
    { key: 'amount', header: 'Amount' },
    { key: 'createdAt', header: 'Date' },
    { key: 'actions', header: 'Actions' },
  ];

  return (
    <div className='payments-list-container'>
      <div className='payments-list-header'>
        <div className='payments-list-header__content'>
          <div className='payments-list-header__icon'>
            <Wallet size={32} />
          </div>
          <div className='payments-list-header__text'>
            <h1 className='payments-list-header__title'>Payments List</h1>
            <p className='payments-list-header__subtitle'>
              View and manage patient payments and receipts
            </p>
          </div>
        </div>
        {/* <Button
          renderIcon={Add}
          onClick={() => {
            // Add your navigation logic for creating new payment
            console.log('Create new payment');
          }}
          className='payments-list-header__action'
        >
          New Payment
        </Button> */}
      </div>

      {error && (
        <div className='payments-list-notification'>
          <InlineNotification
            kind='error'
            title='Error'
            subtitle={error}
            onClose={() => setError('')}
          />
        </div>
      )}

      <div className='payments-list-table-container'>
        <div className='payments-list-filters'>
          <Toggle
            id='today-toggle'
            labelText='Today only'
            toggled={todayOnly}
            onToggle={handleTodayToggle}
            size='sm'
            className='payments-list-filters__today-toggle'
          />

          {!todayOnly && (
            <DatePicker
              datePickerType='range'
              onChange={handleDateRangeChange}
              value={startDate && endDate ? [startDate, endDate] : []}
            >
              <DatePickerInput
                id='date-picker-input-start'
                placeholder='mm/dd/yyyy'
                labelText='Start date'
                size='md'
              />
              <DatePickerInput
                id='date-picker-input-end'
                placeholder='mm/dd/yyyy'
                labelText='End date'
                size='md'
              />
            </DatePicker>
          )}

          {(startDate || endDate || todayOnly) && (
            <Button
              kind='ghost'
              size='sm'
              onClick={clearDateFilters}
              className='payments-list-filters__clear-btn'
            >
              Clear filters
            </Button>
          )}
        </div>
        <DataTable rows={paginatedPayments} headers={headers}>
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
              className='payments-list-table-wrapper'
            >
              <TableToolbar>
                <TableToolbarContent>
                  <TableToolbarSearch
                    persistent
                    placeholder='Search by receipt number or patient name'
                    onChange={(e: any) => setSearchQuery(e.target.value)}
                    value={searchQuery}
                  />
                </TableToolbarContent>
              </TableToolbar>

              <Table {...getTableProps()} className='payments-list-table'>
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
                      const payment = paginatedPayments.find(
                        (p: any) => p.id === row.id,
                      );
                      // console.log(payment);
                      return (
                        <TableRow
                          {...getRowProps({ row })}
                          key={row.id}
                          className='payments-list-table__row'
                        >
                          <TableCell>{payment?.receipt_number}</TableCell>
                          <TableCell>{payment?.patient_name}</TableCell>
                          <TableCell>{payment?.cashier_name}</TableCell>
                          <TableCell>
                            <span className='payments-list-table__amount'>
                              {payment && formatCurrency(payment.amount)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {payment && formatDate(payment.created_at)}
                          </TableCell>
                          <TableCell>
                            <Button
                              kind='ghost'
                              size='sm'
                              renderIcon={Printer}
                              iconDescription='Print Receipt'
                              hasIconOnly
                              onClick={(e) => handlePrintReceipt(payment, e)}
                              className='payments-list-table__print-btn'
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={headers.length}>
                        <div className='payments-list-empty'>
                          <Wallet size={48} />
                          <p className='payments-list-empty__text'>
                            {searchQuery
                              ? 'No payments found matching your search'
                              : 'No payments available'}
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

        {filteredPayments.length > 0 && (
          <div className='payments-list-pagination'>
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              pageSizes={[100]}
              totalItems={totalItems}
              onChange={({ page, pageSize }) => {
                setCurrentPage(page);
                setPageSize(pageSize);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentsList;
