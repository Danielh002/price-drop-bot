import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity({ name: 'product_prices' })
export class ProductPrice {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product, (product) => product.prices, {
    onDelete: 'CASCADE',
  })
  product: Product;

  @Column({ type: 'float' })
  price: number;

  @CreateDateColumn({ name: 'scraped_at' })
  scrapedAt: Date;
}
