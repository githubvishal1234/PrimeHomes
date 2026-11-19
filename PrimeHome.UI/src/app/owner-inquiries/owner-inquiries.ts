import { ToastService } from '../services/toast';
import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { apiErrorMessage } from '../services/auth';

import { Inquiry } from '../models/inquiry';
import { InquiryService } from '../services/inquiry';

@Component({
  selector: 'app-owner-inquiries',
  imports: [CommonModule, FormsModule],
  standalone: true,
  templateUrl: './owner-inquiries.html',
  styleUrl: './owner-inquiries.css'
})
export class OwnerInquiries implements OnInit {

  private toast = inject(ToastService);

  inquiries: Inquiry[] = [];

  replyingTo: number | null = null;
  replyText = '';
  isSending = false;

  constructor(
    private inquiryService: InquiryService,
    private cdr: ChangeDetectorRef
  ) {
  }

  ngOnInit(): void {
    this.loadInquiries();
  }

  loadInquiries(): void {
    this.inquiryService.getOwnerInquiries().subscribe({
      next: (data) => {
        this.inquiries = data;

        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading inquiries:', error);
      }
    });
  }

  updateStatus(inquiry: Inquiry, status: string): void {

  if (!inquiry.inquiryId) {
    return;
  }

  this.inquiryService.updateInquiryStatus(inquiry.inquiryId, status)
    .subscribe({
      next: () => {
        this.toast.success('Inquiry updated successfully.');
        this.loadInquiries();
      },
      error: (error) => {
        this.toast.error(apiErrorMessage(error, 'Unable to update inquiry.'));
      }
    });
}

  startReply(inquiry: Inquiry): void {
    this.replyingTo = inquiry.inquiryId ?? null;
    this.replyText = inquiry.ownerReply ?? '';
  }

  sendReply(inquiry: Inquiry): void {
    if (!inquiry.inquiryId || !this.replyText.trim()) {
      return;
    }

    this.isSending = true;
    this.inquiryService.reply(inquiry.inquiryId, this.replyText.trim()).subscribe({
      next: () => {
        this.isSending = false;
        this.replyingTo = null;
        this.replyText = '';
        this.toast.success('Reply sent. The buyer has been notified.');
        this.loadInquiries();
      },
      error: (error) => {
        this.isSending = false;
        this.toast.error(apiErrorMessage(error, 'Unable to send reply.'));
        this.cdr.detectChanges();
      }
    });
  }

}