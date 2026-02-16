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
  // Button,
  Tag,
  Pagination,
  Loading,
  InlineNotification,
} from '@carbon/react';
import { Receipt } from '@carbon/icons-react';
import './billing-list.scss';
import { useGetAllBillsQuery } from '../../api/Bills';
import { useNavigate } from 'react-router-dom';

export interface Bill {
  id: string;
  patient_name: string;
  // visit_id: string;
  total_amount: number;
  status: 'paid' | 'pending' | 'cancelled';
  created_at: string;
  updated_at: string;
}

const BillingList = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  const billsQuery = useGetAllBillsQuery(
    {
      offset: pageSize * (currentPage - 1),
      patient_query: searchQuery,
    },
    {
      refetchOnMountOrArgChange: true,
      pollingInterval: 120000,
    },
  );

  //   console.log(billsQuery);
  // Handle search and update filtered bills based on query data
  const filteredBills = useMemo(() => {
    const billsData = billsQuery.data || [];

    if (!searchQuery.trim()) {
      return billsData;
    }

    const query = searchQuery.toLowerCase();
    return billsData.filter((bill: Bill) =>
      bill.patient_name.toLowerCase().includes(query),
    );
  }, [searchQuery, billsQuery.data]);

  // Pagination calculations
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedBills = filteredBills.slice(startIndex, endIndex);
  const totalItems = filteredBills.length;

  // Status tag rendering
  const getStatusTag = (status: Bill['status']) => {
    const statusConfig = {
      paid: { type: 'green' as const, label: 'Paid' },
      pending: { type: 'blue' as const, label: 'Pending' },
      cancelled: { type: 'red' as const, label: 'Cancelled' },
      partially_paid: { type: 'purple' as const, label: 'Partially paid' },
    };

    const config = statusConfig[status];
    return <Tag type={config.type}>{config.label}</Tag>;
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'NGN',
      currencyDisplay: 'code', // shows "NGN"
    })
      .format(amount)
      .replace('NGN', '₦'); // replace with HTML symbol
  };

  // Table headers
  const headers = [
    { key: 'billId', header: 'Id' },
    { key: 'patientName', header: 'Patient Name' },
    // { key: 'visitId', header: 'Visit ID' },
    { key: 'total', header: 'Total' },
    { key: 'status', header: 'Status' },
  ];

  // Handle row click - navigate to bill details
  const handleRowClick = (bill: Bill) => {
    navigate(`/finance/bills/${bill.id}`, {
      state: {
        bill: bill,
      },
    });
  };

  if (billsQuery.isLoading) {
    return (
      <div className='billing-list-loading'>
        <Loading description='Loading orders...' withOverlay={false} />
      </div>
    );
  }

  return (
    <div className='billing-list-container'>
      <div className='billing-list-header'>
        <div className='billing-list-header__content'>
          <div className='billing-list-header__icon'>
            <Receipt size={32} />
          </div>
          <div className='billing-list-header__text'>
            <h1 className='billing-list-header__title'>Billing List</h1>
            <p className='billing-list-header__subtitle'>
              View and manage patient bills, payments, and invoices
            </p>
          </div>
        </div>
        {/* <Button
          renderIcon={Add}
          onClick={() => {
            // Add your navigation logic for creating new bill
            console.log('Create new bill');
          }}
          className='billing-list-header__action'
        >
          New Bill
        </Button> */}
      </div>

      {error && (
        <div className='billing-list-notification'>
          <InlineNotification
            kind='error'
            title='Error'
            subtitle={error}
            onClose={() => setError('')}
          />
        </div>
      )}

      {/* <div className='billing-list-stats'>
        <div className='billing-list-stat'>
          <div className='billing-list-stat__icon billing-list-stat__icon--blue'>
            <svg
              viewBox='0 0 24 24'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path
                d='M9 12h6M9 16h6M9 8h6M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </div>
          <div className='billing-list-stat__content'>
            <p className='billing-list-stat__label'>Total Bills</p>
            <p className='billing-list-stat__value'>{bills.length}</p>
          </div>
        </div>

        <div className='billing-list-stat'>
          <div className='billing-list-stat__icon billing-list-stat__icon--green'>
            <svg
              viewBox='0 0 24 24'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path
                d='M20 6L9 17l-5-5'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </div>
          <div className='billing-list-stat__content'>
            <p className='billing-list-stat__label'>Paid</p>
            <p className='billing-list-stat__value'>
              {bills.filter((b) => b.status === 'paid').length}
            </p>
          </div>
        </div>

        <div className='billing-list-stat'>
          <div className='billing-list-stat__icon billing-list-stat__icon--yellow'>
            <svg
              viewBox='0 0 24 24'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
            >
              <circle
                cx='12'
                cy='12'
                r='10'
                stroke='currentColor'
                strokeWidth='2'
              />
              <path
                d='M12 8v4M12 16h.01'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
              />
            </svg>
          </div>
          <div className='billing-list-stat__content'>
            <p className='billing-list-stat__label'>Pending</p>
            <p className='billing-list-stat__value'>
              {bills.filter((b) => b.status === 'pending').length}
            </p>
          </div>
        </div>

        <div className='billing-list-stat'>
          <div className='billing-list-stat__icon billing-list-stat__icon--red'>
            <svg
              viewBox='0 0 24 24'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
            >
              <circle
                cx='12'
                cy='12'
                r='10'
                stroke='currentColor'
                strokeWidth='2'
              />
              <path
                d='M12 8v4M12 16h.01'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
              />
            </svg>
          </div>
          <div className='billing-list-stat__content'>
            <p className='billing-list-stat__label'>Overdue</p>
            <p className='billing-list-stat__value'>
              {bills.filter((b) => b.status === 'overdue').length}
            </p>
          </div>
        </div>
      </div> */}

      <div className='billing-list-table-container'>
        <DataTable rows={paginatedBills} headers={headers}>
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
              className='billing-list-table-wrapper'
            >
              <TableToolbar>
                <TableToolbarContent>
                  <TableToolbarSearch
                    persistent
                    placeholder='Search by patient identifier, name'
                    onChange={(e: any) => setSearchQuery(e.target.value)}
                    value={searchQuery}
                  />
                </TableToolbarContent>
              </TableToolbar>

              <Table {...getTableProps()} className='billing-list-table'>
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
                      const bill = paginatedBills.find(
                        (b: any) => b.id === row.id,
                      );
                      // console.log(bill)
                      return (
                        <TableRow
                          {...getRowProps({ row })}
                          key={row.id}
                          onClick={() => handleRowClick(bill)}
                          className='billing-list-table__row'
                        >
                          <TableCell>{bill?.id}</TableCell>
                          <TableCell>{bill?.patient_name}</TableCell>
                          {/* <TableCell>
                            <span className='billing-list-table__identifier'>
                              {bill?.patientIdentifier}
                            </span>
                          </TableCell> */}
                          {/* <TableCell>{bill?.visit_id}</TableCell> */}
                          <TableCell>
                            <span className='billing-list-table__amount'>
                              {bill && formatCurrency(bill.total_amount)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {bill && getStatusTag(bill.status)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={headers.length}>
                        <div className='billing-list-empty'>
                          <Receipt size={48} />
                          <p className='billing-list-empty__text'>
                            {searchQuery
                              ? 'No bills found matching your search'
                              : 'No bills available'}
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

        {filteredBills.length > 0 && (
          <div className='billing-list-pagination'>
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

export default BillingList;
