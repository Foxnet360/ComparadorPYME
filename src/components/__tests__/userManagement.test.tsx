import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserEditModal, type ManagedUser } from '../../../components/users/UserEditModal';
import { UserManagement } from '../../../components/UserManagement';
import { organizationService } from '../../../services/organizationService';
import type { Ally } from '../../../types';

vi.mock('../../../services/organizationService', () => ({
  organizationService: {
    listOrganizations: vi.fn(),
    getCurrentOrganization: vi.fn(),
    getDirectory: vi.fn(),
    listMembers: vi.fn(),
    updateUser: vi.fn(),
    updateUserStatus: vi.fn(),
    deleteUser: vi.fn(),
    inviteUser: vi.fn(),
    createOrganization: vi.fn(),
    updateOrganization: vi.fn(),
    deleteOrganization: vi.fn(),
  },
}));

const mockAllies: Ally[] = [
  { id: 'org-111', name: 'Correduría Uno', nit: '900.111.111-1', status: 'ACTIVE' },
  { id: 'org-222', name: 'Correduría Dos', nit: '900.222.222-2', status: 'ACTIVE' },
];

const mockUser: ManagedUser = {
  id: 'user-123',
  name: 'Juan Perez',
  email: 'juan@correduria.com',
  role: 'ally_technical',
  allyId: 'org-111',
  allyName: 'Correduría Uno',
  status: 'ACTIVE',
  createdAt: '2026-01-01',
};

describe('UserEditModal component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <UserEditModal
        isOpen={false}
        onClose={vi.fn()}
        currentUserRole="super_admin"
        alliesList={mockAllies}
        user={mockUser}
        onUpdate={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders user details when open for super_admin', () => {
    render(
      <UserEditModal
        isOpen={true}
        onClose={vi.fn()}
        currentUserRole="super_admin"
        alliesList={mockAllies}
        user={mockUser}
        onUpdate={vi.fn()}
      />
    );

    expect(screen.getByText('Editar Usuario')).toBeTruthy();
    expect(screen.getByDisplayValue('juan@correduria.com')).toBeTruthy();
    expect(screen.getByDisplayValue('Juan Perez')).toBeTruthy();
    expect(screen.getByDisplayValue('Técnico Analista')).toBeTruthy();
    expect(screen.getByDisplayValue('Correduría Uno')).toBeTruthy();
    expect(screen.getByDisplayValue('Activo')).toBeTruthy();
  });

  it('restricts role and ally modification when currentUserRole is ally_admin', () => {
    render(
      <UserEditModal
        isOpen={true}
        onClose={vi.fn()}
        currentUserRole="ally_admin"
        alliesList={mockAllies}
        user={mockUser}
        onUpdate={vi.fn()}
      />
    );

    // ally_admin sees static text or disabled field for correduría
    const allyInput = screen.getByDisplayValue('Correduría Uno');
    expect(allyInput).toHaveProperty('disabled', true);
    // Role selector shouldn't exist for ally_admin
    expect(screen.queryByText('Rol de Usuario')).toBeNull();
  });

  it('calls onUpdate with modified data on submit', async () => {
    const handleUpdate = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();

    render(
      <UserEditModal
        isOpen={true}
        onClose={handleClose}
        currentUserRole="super_admin"
        alliesList={mockAllies}
        user={mockUser}
        onUpdate={handleUpdate}
      />
    );

    const nameInput = screen.getByDisplayValue('Juan Perez');
    fireEvent.change(nameInput, { target: { value: 'Juan Perez Actualizado' } });

    const submitBtn = screen.getByText('Guardar Cambios');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleUpdate).toHaveBeenCalledWith('user-123', expect.objectContaining({
        name: 'Juan Perez Actualizado',
        role: 'ally_technical',
        orgId: 'org-111',
        status: 'ACTIVE',
      }));
      expect(handleClose).toHaveBeenCalled();
    });
  });
});

describe('UserManagement component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (organizationService.listOrganizations as any).mockResolvedValue(mockAllies);
    (organizationService.getCurrentOrganization as any).mockResolvedValue({
      role: 'super_admin',
      orgId: 'org-111',
      organization: mockAllies[0],
    });
    (organizationService.getDirectory as any).mockResolvedValue([mockUser]);
  });

  it('mounts and displays user directory correctly', async () => {
    render(
      <UserManagement
        currentUserRole="super_admin"
        currentAllyId="org-111"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Gestión Global de Usuarios y Aliados')).toBeTruthy();
      expect(screen.getByText('Juan Perez')).toBeTruthy();
      expect(screen.getByText('juan@correduria.com')).toBeTruthy();
    });
  });

  it('opens UserEditModal when clicking edit button', async () => {
    render(
      <UserManagement
        currentUserRole="super_admin"
        currentAllyId="org-111"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Juan Perez')).toBeTruthy();
    });

    const editBtn = screen.getByTitle('Editar usuario');
    fireEvent.click(editBtn);

    await waitFor(() => {
      expect(screen.getByText('Editar Usuario')).toBeTruthy();
      expect(screen.getByDisplayValue('Juan Perez')).toBeTruthy();
    });
  });

  it('toggles user status when status button is clicked', async () => {
    (organizationService.updateUserStatus as any).mockResolvedValue({
      success: true,
      userId: 'user-123',
      status: 'INACTIVE',
    });

    render(
      <UserManagement
        currentUserRole="super_admin"
        currentAllyId="org-111"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Juan Perez')).toBeTruthy();
    });

    const toggleStatusBtn = screen.getByTitle('Desactivar usuario');
    fireEvent.click(toggleStatusBtn);

    await waitFor(() => {
      expect(organizationService.updateUserStatus).toHaveBeenCalledWith('user-123', 'INACTIVE');
    });
  });

  it('confirms and deletes user when delete button is clicked', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    (organizationService.deleteUser as any).mockResolvedValue({ success: true });

    render(
      <UserManagement
        currentUserRole="super_admin"
        currentAllyId="org-111"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Juan Perez')).toBeTruthy();
    });

    const deleteBtn = screen.getByTitle('Eliminar usuario');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(organizationService.deleteUser).toHaveBeenCalledWith('user-123');
    });
  });
});
