export type PersonId = string;

export interface Person {
  id: PersonId;
  name: string;
  deletedAt?: Date | null;
  createdAt: Date;
}
