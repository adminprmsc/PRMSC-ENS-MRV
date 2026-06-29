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
exports.UserTehsil = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
let UserTehsil = class UserTehsil {
    userId;
    tehsil;
    createdAt;
    updatedAt;
    user;
};
exports.UserTehsil = UserTehsil;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'user_id', type: 'varchar', length: 36 }),
    __metadata("design:type", String)
], UserTehsil.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], UserTehsil.prototype, "tehsil", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], UserTehsil.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], UserTehsil.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, (user) => user.tehsilLinks, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], UserTehsil.prototype, "user", void 0);
exports.UserTehsil = UserTehsil = __decorate([
    (0, typeorm_1.Entity)('user_tehsils')
], UserTehsil);
//# sourceMappingURL=user-tehsil.entity.js.map