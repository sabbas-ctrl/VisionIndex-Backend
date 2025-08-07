import mongoose from 'mongoose';

const ROLES = ['admin', 'developer', 'uploader', 'data_provider', 'viewer'];
const PERMISSIONS = [
  'can_upload',
  'can_download',
  'can_annotate',
  'can_manage_users',
  'can_view_logs',
  'can_edit_profile',
  'can_manage_roles'
];

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ROLES,
      default: 'viewer',
    },
    permissions: {
      type: [String],
      enum: PERMISSIONS,
      default: [],
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
      refreshToken: {
      type: String,
      default: null,
  },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);
export default User;
export { ROLES, PERMISSIONS };