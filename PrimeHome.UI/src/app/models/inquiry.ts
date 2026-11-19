export interface Inquiry {
  inquiryId?: number;
  propertyId: number;
  propertyTitle?: string;
  buyerId?: number;
  ownerId?: number;
  message: string;
  /** New → Viewed → Responded → Closed */
  status?: string;
  createdDate?: string;
  buyerName?: string | null;
  ownerReply?: string | null;
  respondedDate?: string | null;
}