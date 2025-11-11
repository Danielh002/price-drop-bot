import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Alert {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  searchTerm: string;

  @Column('float')
  priceThreshold: number;

  @Column()
  email: string;
}
