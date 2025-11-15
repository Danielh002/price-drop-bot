import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Store } from './store.entity';
import { ProductPrice } from './product-price.entity';
import { ProductGroupItem } from './product-group-item.entity';

@Entity({ name: 'products' })
@Unique(['store', 'url'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Store, (store) => store.products, { eager: true })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column()
  url: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  image?: string;

  @Column({ nullable: true })
  brand?: string;

  @Column({ nullable: true })
  sku?: string;

  @Column({ nullable: true })
  ean?: string;

  @Column({ nullable: true })
  category?: string;

  @Column({ name: 'current_price', type: 'float' })
  price: number;

  @Column({ default: 'COP' })
  currency: string;

  @Column({ nullable: true })
  seller?: string;

  @Column({ nullable: true })
  country?: string;

  @Column({ name: 'search_term', nullable: true })
  searchTerm?: string;

  @Column({
    name: 'last_seen',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  scrapedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => ProductPrice, (price) => price.product)
  prices: ProductPrice[];

  @OneToMany(() => ProductGroupItem, (item) => item.product)
  groupItems: ProductGroupItem[];
}
