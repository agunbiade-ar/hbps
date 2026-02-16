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
  Pagination,
} from '@carbon/react';
import { UserFollow, ArrowLeft, Renew } from '@carbon/icons-react';
import { useNavigate } from 'react-router-dom';
import './register-user.scss';
import { useGetAllUsersQuery, useRegisterUserMutation } from '../../api/Users';

interface OpenmrsUser {
  uuid: string;
  display?: string;
}

export const RegisterUser = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OpenmrsUser | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [registerUser] =
    useRegisterUserMutation();

  const getUsersQuery = useGetAllUsersQuery(
    {
      limit: pageSize,
      offset: currentPage,
    },
    {
      refetchOnMountOrArgChange: true,
      refetchOnReconnect: true,
    },
  );

  const isRefreshing = getUsersQuery.isFetching && !getUsersQuery.isLoading;

  const handleRefresh = () => {
    getUsersQuery.refetch();
  };

  const users: OpenmrsUser[] = useMemo(() => {
    const users_ = getUsersQuery.data?.users || [];
    return users_;
  }, [getUsersQuery]);

  // Get display name from user object
  const getUserDisplayName = (user: OpenmrsUser): string => {
    return user?.display || 'Unknown User';
  };

  // Get username or system ID
  const getUserIdentifier = (user: OpenmrsUser): string => {
    return user.uuid;
  };

  // Handle search and filter users
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) {
      return users;
    }

    const query = searchQuery.toLowerCase();
    return users.filter((user: OpenmrsUser) => {
      const displayName = getUserDisplayName(user).toLowerCase();
      const username = getUserIdentifier(user).toLowerCase();

      return displayName.includes(query) || username.includes(query);
    });
  }, [searchQuery, users]);

  // Handle row click
  const handleUserClick = (user: OpenmrsUser) => {
    setSelectedUser(user);
    setIsRegisterModalOpen(true);
  };

  // Handle register confirmation
  const handleRegisterConfirm = async () => {
    if (!selectedUser) return;

    setError('');
    setIsProcessing(true);
    try {
      await registerUser({
        openmrs_uuid: selectedUser.uuid,
      }).unwrap();
    } catch (error) {
      setError(error as string);
    } finally {
      setIsProcessing(false);
      setIsRegisterModalOpen(false);
    }
  };

  // Handle modal close
  const handleModalClose = () => {
    if (!isProcessing) {
      setIsRegisterModalOpen(false);
      setSelectedUser(null);
    }
  };

  // Handle pagination change
  const handlePaginationChange = ({
    page,
    pageSize,
  }: {
    page: number;
    pageSize: number;
  }) => {
    setCurrentPage(page);
    setPageSize(pageSize);
  };

  // Table headers
  const headers = [
    { key: 'uuid', header: 'id' },
    { key: 'username', header: 'Username' },
  ];

  // Prepare table rows
  const tableRows = filteredUsers.map((user) => ({
    id: user.uuid,
    username: getUserDisplayName(user),
  }));

  if (getUsersQuery.isLoading && !isRefreshing) {
    return (
      <div className='register-user-loading'>
        <Loading description='Loading users...' withOverlay={false} />
      </div>
    );
  }

  return (
    <div className='register-user-container'>
      {/* Header */}
      <div className='register-user-header'>
        <Button
          kind='ghost'
          renderIcon={ArrowLeft}
          onClick={() => navigate(-1)}
          className='register-user-header__back'
        >
          Back
        </Button>

        <div className='register-user-header__content'>
          <div className='register-user-header__icon'>
            <UserFollow size={32} />
          </div>
          <div className='register-user-header__text'>
            <h1 className='register-user-header__title'>Register Users</h1>
            <p className='register-user-header__subtitle'>
              Click on a user to register them in the system
            </p>
          </div>
        </div>

        <Button
          kind='ghost'
          renderIcon={Renew}
          onClick={handleRefresh}
          disabled={isRefreshing}
          className='register-user-header__refresh'
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {getUsersQuery.error && (
        <div className='register-user-notification'>
          <InlineNotification
            kind='error'
            title='Error'
            subtitle={error}
            onClose={() => setError('')}
          />
        </div>
      )}

      {success && (
        <div className='register-user-notification'>
          <InlineNotification
            kind='success'
            title='Success'
            subtitle={success}
            onClose={() => setSuccess('')}
          />
        </div>
      )}

      {/* Users Table */}
      <div className='register-user-table-container'>
        <DataTable rows={tableRows} headers={headers}>
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
              className='register-user-table-wrapper'
            >
              <TableToolbar>
                <TableToolbarContent>
                  <TableToolbarSearch
                    persistent
                    placeholder='Search by name, username, or role'
                    onChange={(e: any) => setSearchQuery(e.target.value)}
                    value={searchQuery}
                  />
                </TableToolbarContent>
              </TableToolbar>

              <Table {...getTableProps()} className='register-user-table'>
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
                      const user = filteredUsers.find((u) => u.uuid === row.id);
                      if (!user) return null;

                      return (
                        <TableRow
                          {...getRowProps({ row })}
                          key={row.id}
                          className='register-user-table__row'
                          onClick={() => handleUserClick(user)}
                        >
                          <TableCell>
                            <div className='register-user-table__email'>
                              {user.uuid}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className='register-user-table__name'>
                              {getUserDisplayName(user)}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={headers.length}>
                        <div className='register-user-empty'>
                          <UserFollow size={48} />
                          <p className='register-user-empty__text'>
                            {searchQuery
                              ? 'No users found matching your search'
                              : 'No users available to register'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {/* {!searchQuery && totalUsers > 0 && ( */}
              {!searchQuery && (
                <Pagination
                  backwardText='Previous page'
                  forwardText='Next page'
                  itemsPerPageText='Items per page:'
                  page={currentPage}
                  pageSize={pageSize}
                  pageSizes={[100]}
                  // totalItems={totalUsers}
                  onChange={handlePaginationChange}
                />
              )}
            </TableContainer>
          )}
        </DataTable>
      </div>

      {/* Register Confirmation Modal */}
      <Modal
        open={isRegisterModalOpen}
        onRequestClose={handleModalClose}
        modalHeading='Register User'
        primaryButtonText={
          isProcessing ? 'Registering...' : 'Confirm Registration'
        }
        secondaryButtonText='Cancel'
        onRequestSubmit={handleRegisterConfirm}
        primaryButtonDisabled={isProcessing}
        danger={false}
        size='sm'
      >
        {selectedUser && (
          <>
            <p className='register-user-modal__text'>
              Are you sure you want to register this user? They will be added to
              the system and granted access.
            </p>
            <div className='register-user-modal__details'>
              <div className='register-user-modal__user-info'>
                <div className='register-user-modal__field'>
                  <strong>User:</strong> {getUserDisplayName(selectedUser)}
                </div>
                <div className='register-user-modal__field'>
                  <strong>UUID:</strong> {getUserIdentifier(selectedUser)}
                </div>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};
