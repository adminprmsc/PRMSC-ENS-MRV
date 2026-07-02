import { useMemo, useState } from "react";
import {
  KeyRound,
  Loader2,
  Pencil,
  RefreshCcw,
  Search,
  Shield,
  UserPlus,
  UserX,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader, PageShell, PasswordField } from "@/components/layout";
import {
  DataListCard,
  DataTableWrap,
  kv,
} from "@/components/layout/tehsil-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLE, normalizeRole, type UserRole } from "@/constants/roles";
import { useAuth } from "@/contexts/AuthContext";
import { useUsersApi } from "@/hooks";
import { getApiErrorMessage } from "@/lib/api-error";
import type {
  ListedUser,
  OperatorWaterSystemAssignment,
} from "@/services/usersService";
import { TEHSIL_OPTIONS } from "@/utils/locationData";

function operatorTehsils(user: ListedUser): string[] {
  const fromSystems = [
    ...new Set((user.water_systems ?? []).map((ws) => ws.tehsil).filter(Boolean)),
  ].sort();
  if (fromSystems.length) return fromSystems;
  return user.tehsils ?? [];
}

function userSearchText(user: ListedUser): string {
  const parts = [
    user.name,
    user.email,
    user.role,
    tehsilSummary(user),
    user.is_active ? "active" : "inactive",
    ...(user.water_systems ?? []).flatMap((ws) => [
      ws.unique_identifier,
      ws.tehsil,
      ws.village,
      ws.settlement ?? "",
    ]),
  ];
  return parts.join(" ").toLowerCase();
}

function tehsilSummary(user: ListedUser): string {
  if (user.role === ROLE.SUPER_ADMIN) {
    return user.review_tehsils?.length
      ? user.review_tehsils.join(", ")
      : "No review tehsils";
  }
  if (user.role === ROLE.ADMIN) {
    return user.tehsils.length ? user.tehsils.join(", ") : "No tehsils";
  }
  if (user.role === ROLE.USER) {
    const tehsils = operatorTehsils(user);
    return tehsils.length ? tehsils.join(", ") : "No tehsil";
  }
  return "—";
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant={active ? "secondary" : "outline"}
      className={
        active
          ? "border-emerald-200 bg-emerald-50 font-normal text-emerald-700"
          : "border-red-200 bg-red-50 font-normal text-red-700"
      }
    >
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

function OperatorWaterSystemsList({
  systems,
}: {
  systems: OperatorWaterSystemAssignment[];
}) {
  if (!systems.length) {
    return <span className="text-muted-foreground">No water systems assigned</span>;
  }
  return (
    <ul className="space-y-1.5">
      {systems.map((ws) => (
        <li key={ws.id} className="rounded-md border border-border/50 bg-muted/20 px-2 py-1.5 text-xs">
          <span className="font-mono font-medium text-foreground">
            {ws.unique_identifier}
          </span>
          <span className="mt-0.5 block text-muted-foreground">
            {ws.tehsil} · {ws.village}
            {ws.settlement ? ` · ${ws.settlement}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function normalizeListedUserRole(role: string): UserRole | undefined {
  return normalizeRole(role);
}

type UserFormState = {
  name: string;
  email: string;
  password: string;
  role_code: string;
  is_active: boolean;
  tehsils: Set<string>;
  water_system_ids: Set<string>;
};

function emptyForm(roleCode = ROLE.SUPER_ADMIN): UserFormState {
  return {
    name: "",
    email: "",
    password: "ChangeMe123!",
    role_code: roleCode,
    is_active: true,
    tehsils: new Set(),
    water_system_ids: new Set(),
  };
}

function formFromUser(user: ListedUser): UserFormState {
  const tehsils =
    user.role === ROLE.SUPER_ADMIN
      ? new Set(user.review_tehsils ?? [])
      : new Set(user.tehsils ?? []);
  return {
    name: user.name,
    email: user.email,
    password: "",
    role_code: user.role,
    is_active: user.is_active !== false,
    tehsils,
    water_system_ids: new Set(user.water_system_ids ?? []),
  };
}

const USER_CATEGORIES: Array<{
  role: UserRole;
  title: string;
  description: string;
}> = [
  {
    role: ROLE.SYSTEM_ADMIN,
    title: "Platform administrators",
    description: "User accounts, roles, tehsil scope, and password management.",
  },
  {
    role: ROLE.SUPER_ADMIN,
    title: "Manager Operations",
    description: "HQ dashboard and submissions review for assigned tehsils.",
  },
  {
    role: ROLE.ADMIN,
    title: "Tehsil managers",
    description: "Tehsil-scoped facility operations and verification.",
  },
  {
    role: ROLE.USER,
    title: "Tubewell operators",
    description:
      "Field logging accounts. Each operator is linked to water systems and tehsils shown below.",
  },
];

type UserRowActions = {
  onEdit: (user: ListedUser) => void;
  onReset: (user: ListedUser) => void;
  onToggleActive: (user: ListedUser) => void;
};

function UserTableBody({
  users,
  actions,
  categoryRole,
}: {
  users: ListedUser[];
  actions: UserRowActions;
  categoryRole: UserRole;
}) {
  const isOperatorCategory = categoryRole === ROLE.USER;
  const colSpan = isOperatorCategory ? 6 : 6;

  if (users.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="py-8 text-center text-sm text-muted-foreground">
          No users in this category.
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {users.map((user) => (
        <TableRow
          key={user.id}
          className={user.is_active === false ? "opacity-60" : undefined}
        >
          <TableCell className="font-medium">{kv(user.name)}</TableCell>
          <TableCell>{kv(user.email)}</TableCell>
          <TableCell>
            <StatusBadge active={user.is_active !== false} />
          </TableCell>
          {isOperatorCategory ? (
            <>
              <TableCell className="text-sm text-muted-foreground">
                {operatorTehsils(user).join(", ") || "—"}
              </TableCell>
              <TableCell className="min-w-[220px] max-w-md">
                <OperatorWaterSystemsList systems={user.water_systems ?? []} />
              </TableCell>
            </>
          ) : (
            <TableCell className="max-w-xs text-sm text-muted-foreground">
              <span className="line-clamp-2" title={tehsilSummary(user)}>
                {tehsilSummary(user)}
              </span>
            </TableCell>
          )}
          <TableCell className="text-right">
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label={user.is_active === false ? "Activate user" : "Deactivate user"}
                title={user.is_active === false ? "Activate user" : "Deactivate user"}
                onClick={() => actions.onToggleActive(user)}
              >
                <UserX className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Edit user"
                onClick={() => actions.onEdit(user)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Reset password"
                onClick={() => actions.onReset(user)}
              >
                <KeyRound className="size-4" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export default function UsersAdminPage() {
  const { user: currentUser } = useAuth();
  const {
    users,
    usersLoading,
    roles,
    waterSystems,
    refetchUsers,
    createUser,
    createLoading,
    updateUser,
    updateLoading,
    resetPassword,
    resetLoading,
  } = useUsersApi();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<ListedUser | null>(null);
  const [resetUser, setResetUser] = useState<ListedUser | null>(null);
  const [createForm, setCreateForm] = useState<UserFormState>(emptyForm());
  const [editForm, setEditForm] = useState<UserFormState>(emptyForm());
  const [resetPasswordValue, setResetPasswordValue] = useState("ChangeMe123!");

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = users ?? [];
    if (roleFilter !== "all") {
      list = list.filter((u) => u.role === roleFilter);
    }
    if (!q) return list;
    return list.filter((u) => userSearchText(u).includes(q));
  }, [search, users, roleFilter]);

  const usersByCategory = useMemo(() => {
    const grouped = new Map<UserRole, ListedUser[]>();
    for (const cat of USER_CATEGORIES) {
      grouped.set(cat.role, []);
    }
    for (const user of filteredUsers) {
      const role = normalizeListedUserRole(user.role);
      if (role && grouped.has(role)) {
        grouped.get(role)!.push(user);
      }
    }
    return USER_CATEGORIES.map((cat) => ({
      ...cat,
      users: grouped.get(cat.role) ?? [],
    }))
      .filter((cat) => roleFilter === "all" || cat.role === roleFilter)
      .filter(
        (cat) =>
          roleFilter !== "all" || cat.users.length > 0 || usersLoading,
      );
  }, [filteredUsers, roleFilter, usersLoading]);

  const rowActions: UserRowActions = useMemo(
    () => ({
      onEdit: (user) => {
        setEditUser(user);
        setEditForm(formFromUser(user));
      },
      onReset: (user) => setResetUser(user),
      onToggleActive: (user) => {
        if (currentUser?.id === user.id && user.is_active !== false) {
          toast.error("You cannot deactivate your own account.");
          return;
        }
        void (async () => {
          try {
            await updateUser({
              userId: user.id,
              payload: { is_active: user.is_active === false },
            });
            toast.success(
              user.is_active === false ? "User activated." : "User deactivated.",
            );
          } catch (e: unknown) {
            toast.error(getApiErrorMessage(e, "Could not update user status"));
          }
        })();
      },
    }),
    [updateUser, currentUser?.id],
  );

  const roleOptions = useMemo(
    () =>
      (roles ?? []).filter((r) =>
        [ROLE.SUPER_ADMIN, ROLE.ADMIN, ROLE.USER, ROLE.SYSTEM_ADMIN].includes(
          r.code as (typeof ROLE)[keyof typeof ROLE],
        ),
      ),
    [roles],
  );

  const needsTehsils = (role: string) =>
    role === ROLE.SUPER_ADMIN || role === ROLE.ADMIN;
  const needsWaterSystems = (role: string) => role === ROLE.USER;

  const toggleTehsil = (
    form: UserFormState,
    setForm: (f: UserFormState) => void,
    tehsil: string,
  ) => {
    const next = new Set(form.tehsils);
    if (next.has(tehsil)) next.delete(tehsil);
    else next.add(tehsil);
    setForm({ ...form, tehsils: next });
  };

  const toggleWaterSystem = (
    form: UserFormState,
    setForm: (f: UserFormState) => void,
    id: string,
  ) => {
    const next = new Set(form.water_system_ids);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setForm({ ...form, water_system_ids: next });
  };

  const validateForm = (form: UserFormState, isEdit: boolean): string | null => {
    if (!form.name.trim()) return "Name is required.";
    if (!isEdit && !form.email.trim()) return "Email is required.";
    if (!isEdit && !form.password.trim()) return "Password is required.";
    if (needsTehsils(form.role_code) && form.tehsils.size < 1) {
      return form.role_code === ROLE.SUPER_ADMIN
        ? "Select at least one review tehsil."
        : "Select at least one tehsil.";
    }
    if (needsWaterSystems(form.role_code) && form.water_system_ids.size < 1) {
      return "Select at least one water system.";
    }
    return null;
  };

  const handleCreate = async () => {
    const err = validateForm(createForm, false);
    if (err) {
      toast.error(err);
      return;
    }
    try {
      await createUser({
        name: createForm.name.trim(),
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
        role_code: createForm.role_code,
        ...(needsTehsils(createForm.role_code)
          ? { tehsils: [...createForm.tehsils] }
          : {}),
        ...(needsWaterSystems(createForm.role_code)
          ? { water_system_ids: [...createForm.water_system_ids] }
          : {}),
      });
      toast.success("User created.");
      setCreateOpen(false);
      setCreateForm(emptyForm());
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not create user"));
    }
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    if (
      currentUser?.id === editUser.id &&
      editUser.is_active !== false &&
      !editForm.is_active
    ) {
      toast.error("You cannot deactivate your own account.");
      return;
    }
    const err = validateForm(editForm, true);
    if (err) {
      toast.error(err);
      return;
    }
    try {
      await updateUser({
        userId: editUser.id,
        payload: {
          name: editForm.name.trim(),
          role_code: editForm.role_code,
          is_active: editForm.is_active,
          tehsils: needsTehsils(editForm.role_code)
            ? [...editForm.tehsils]
            : [],
          water_system_ids: needsWaterSystems(editForm.role_code)
            ? [...editForm.water_system_ids]
            : [],
        },
      });
      toast.success("User updated.");
      setEditUser(null);
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not update user"));
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    if (!resetPasswordValue.trim()) {
      toast.error("Enter a new password.");
      return;
    }
    try {
      await resetPassword({
        userId: resetUser.id,
        new_password: resetPasswordValue,
      });
      toast.success("Password reset.");
      setResetUser(null);
      setResetPasswordValue("ChangeMe123!");
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Could not reset password"));
    }
  };

  const renderScopeFields = (
    form: UserFormState,
    setForm: (f: UserFormState) => void,
  ) => {
    if (needsTehsils(form.role_code)) {
      return (
        <div className="space-y-2">
          <Label>
            {form.role_code === ROLE.SUPER_ADMIN
              ? "Review tehsils (HQ dashboard scope)"
              : "Assigned tehsils"}
          </Label>
          <ScrollArea className="h-48 rounded-md border border-border/60 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {TEHSIL_OPTIONS.map((tehsil) => (
                <label
                  key={tehsil}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={form.tehsils.has(tehsil)}
                    onCheckedChange={() => toggleTehsil(form, setForm, tehsil)}
                  />
                  <span className="truncate">{tehsil}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
        </div>
      );
    }
    if (needsWaterSystems(form.role_code)) {
      return (
        <div className="space-y-2">
          <Label>Water systems</Label>
          <ScrollArea className="h-48 rounded-md border border-border/60 p-3">
            <div className="space-y-2">
              {(waterSystems ?? []).map((ws) => (
                <label
                  key={ws.id}
                  className="flex cursor-pointer items-start gap-2 text-sm"
                >
                  <Checkbox
                    checked={form.water_system_ids.has(ws.id)}
                    onCheckedChange={() =>
                      toggleWaterSystem(form, setForm, ws.id)
                    }
                  />
                  <span>
                    <span className="font-medium">{ws.unique_identifier}</span>
                    <span className="block text-xs text-muted-foreground">
                      {ws.tehsil} · {ws.village}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </ScrollArea>
        </div>
      );
    }
    return (
      <p className="text-sm text-muted-foreground">
        No tehsil scope required for this role.
      </p>
    );
  };

  return (
    <PageShell>
      <PageHeader
        icon={<Shield className="size-5" />}
        title="User administration"
        description="Create portal accounts, assign roles and scope, activate or deactivate users. Inactive users cannot sign in."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetchUsers()}
              disabled={usersLoading}
            >
              <RefreshCcw className="mr-1.5 size-4" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <UserPlus className="mr-1.5 size-4" />
              Create user
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, tehsil, water system, status…"
            className="h-9 pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={roleFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setRoleFilter("all")}
          >
            All roles
          </Button>
          {USER_CATEGORIES.map((cat) => (
            <Button
              key={cat.role}
              variant={roleFilter === cat.role ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter(cat.role)}
            >
              {cat.title}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {usersByCategory.map((category) => (
          <DataListCard
            key={category.role}
            title={category.title}
            count={category.users.length}
            loading={usersLoading}
            toolbar={
              <p className="max-w-xl text-xs text-muted-foreground">
                {category.description}
              </p>
            }
          >
            <DataTableWrap>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    {category.role === ROLE.USER ? (
                      <>
                        <TableHead>Tehsil</TableHead>
                        <TableHead>Assigned water systems</TableHead>
                      </>
                    ) : (
                      <TableHead>Scope</TableHead>
                    )}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <UserTableBody
                    users={category.users}
                    actions={rowActions}
                    categoryRole={category.role}
                  />
                </TableBody>
              </Table>
            </DataTableWrap>
          </DataListCard>
        ))}

        {!usersLoading && filteredUsers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/60 py-10 text-center text-sm text-muted-foreground">
            No users match your search or filter.
          </p>
        ) : null}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
            <DialogDescription>
              Manager Operations users need review tehsils for HQ dashboard access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="create-name">Name</Label>
              <Input
                id="create-name"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm({ ...createForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm({ ...createForm, email: e.target.value })
                }
              />
            </div>
            <PasswordField
              id="create-password"
              label="Initial password"
              value={createForm.password}
              onChange={(value) =>
                setCreateForm({ ...createForm, password: value })
              }
            />
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={createForm.role_code}
                onValueChange={(v) =>
                  setCreateForm({
                    ...createForm,
                    role_code: v ?? ROLE.SUPER_ADMIN,
                    tehsils: new Set(),
                    water_system_ids: new Set(),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r.code} value={r.code}>
                      {r.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {renderScopeFields(createForm, setCreateForm)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} disabled={createLoading}>
              {createLoading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Users className="mr-2 size-4" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>{editUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={editForm.role_code}
                onValueChange={(v) =>
                  setEditForm({
                    ...editForm,
                    role_code: v ?? editForm.role_code,
                    tehsils: new Set(),
                    water_system_ids: new Set(),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r.code} value={r.code}>
                      {r.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="edit-active">Account active</Label>
                <p className="text-xs text-muted-foreground">
                  Inactive users cannot sign in or use the portal.
                </p>
              </div>
              <Switch
                id="edit-active"
                checked={editForm.is_active}
                disabled={
                  currentUser?.id === editUser?.id && editForm.is_active
                }
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, is_active: checked })
                }
              />
            </div>
            {renderScopeFields(editForm, setEditForm)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Cancel
            </Button>
            <Button onClick={() => void handleUpdate()} disabled={updateLoading}>
              {updateLoading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!resetUser}
        onOpenChange={(o) => !o && setResetUser(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetUser?.name} ({resetUser?.email}).
            </DialogDescription>
          </DialogHeader>
          <PasswordField
            id="reset-password"
            label="New password"
            value={resetPasswordValue}
            onChange={setResetPasswordValue}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleResetPassword()}
              disabled={resetLoading}
            >
              {resetLoading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 size-4" />
              )}
              Reset password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
