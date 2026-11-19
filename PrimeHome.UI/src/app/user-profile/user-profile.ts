import { Icon } from '../shared/icon/icon';
import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  UserProfileService,
  type MyProfileResponse,
  type UserProfile as UserProfileModel
} from '../services/user-profile';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [Icon, CommonModule, FormsModule],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.css'
})
export class UserProfile implements OnInit {
  name = '';
  email = '';
  phone = '';
  role = '';

  profile: UserProfileModel = {};
  isLoading = true;
  isSaving = false;
  isUploadingImage = false;
  selectedImage: File | null = null;
  imagePreviewUrl = '';

  constructor(
    private userProfileService: UserProfileService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.isLoading = true;

    this.userProfileService.getMyProfile().subscribe({
      next: (data: MyProfileResponse) => {
        this.name = data.name ?? '';
        this.email = data.email ?? '';
        this.phone = data.phone ?? '';
        this.role = data.role ?? '';
        this.profile = data.profile ?? {};
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading profile:', error);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  saveProfile(): void {
    this.isSaving = true;

    const payload: UserProfileModel = {
      ...this.profile,
      userId: this.profile.userId ?? undefined
    };

    const request$ = payload.userProfileId
      ? this.userProfileService.updateProfile(payload)
      : this.userProfileService.createProfile(payload);

    request$.subscribe({
      next: (savedProfile) => {
        this.profile = savedProfile;
        this.isSaving = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error saving profile:', error);
        this.isSaving = false;
        this.cdr.detectChanges();
      }
    });
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    this.selectedImage = file;
    this.imagePreviewUrl = URL.createObjectURL(file);
  }

  uploadProfileImage(): void {
    if (!this.selectedImage) {
      return;
    }

    this.isUploadingImage = true;

    this.userProfileService.uploadProfileImage(this.selectedImage).subscribe({
      next: (response: any) => {
        const uploadedImageUrl =
          response?.profileImageUrl ??
          response?.imageUrl ??
          response?.url ??
          '';

        if (uploadedImageUrl) {
          this.profile.profileImageUrl = uploadedImageUrl;
        }

        this.selectedImage = null;
        this.imagePreviewUrl = '';
        this.isUploadingImage = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error uploading profile image:', error);
        this.isUploadingImage = false;
        this.cdr.detectChanges();
      }
    });
  }
}
