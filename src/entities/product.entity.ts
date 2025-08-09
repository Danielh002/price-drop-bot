import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column('float')
  price: number;

  @Column()
  url: string;

  @Column()
  store: string;

  @Column()
  seller: string;

  @Column()
  country: string;

  @Column()
  currency: string;

  @Column()
  searchTerm: string;

  @Column()
  scrapedAt: Date;
}
