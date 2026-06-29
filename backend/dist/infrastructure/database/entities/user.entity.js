"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const typeorm_1 = require("typeorm");
const uuid_1 = require("uuid");
const werkzeug_password_1 = require("../../auth/werkzeug-password");
const role_entity_1 = require("./role.entity");
const user_tehsil_entity_1 = require("./user-tehsil.entity");
const user_water_system_entity_1 = require("./user-water-system.entity");
let User = class User {
    id;
    name;
    email;
    passwordHash;
    phone;
    signatureSvg;
    roleId;
    createdAt;
    updatedAt;
    assignedRole;
    tehsilLinks;
    waterSystemLinks;
    get role() {
        return this.assignedRole?.code ?? null;
    }
    get assignedWaterSystemIds() {
        return (this.waterSystemLinks ?? []).map((link) => String(link.waterSystemId));
    }
    setPassword(password) {
        this.passwordHash = (0, werkzeug_password_1.generatePasswordHash)(password);
    }
    checkPassword(password) {
        return (0, werkzeug_password_1.checkPasswordHash)(this.passwordHash, password);
    }
};
exports.User = User;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 36, default: () => (0, uuid_1.v4)() }),
    __metadata("design:type", String)
], User.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], User.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 150, unique: true }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'password_hash', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], User.prototype, "passwordHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'signature_svg', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "signatureSvg", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'role_id', type: 'varchar', length: 36 }),
    __metadata("design:type", String)
], User.prototype, "roleId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], User.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], User.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => role_entity_1.Role, (role) => role.users, { eager: true }),
    (0, typeorm_1.JoinColumn)({ name: 'role_id' }),
    __metadata("design:type", role_entity_1.Role)
], User.prototype, "assignedRole", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => user_tehsil_entity_1.UserTehsil, (link) => link.user, { cascade: true }),
    __metadata("design:type", Array)
], User.prototype, "tehsilLinks", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => user_water_system_entity_1.UserWaterSystem, (link) => link.user, { cascade: true }),
    __metadata("design:type", Array)
], User.prototype, "waterSystemLinks", void 0);
exports.User = User = __decorate([
    (0, typeorm_1.Entity)('users')
], User);
//# sourceMappingURL=user.entity.js.map