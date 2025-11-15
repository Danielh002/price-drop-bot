import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ProductGroup } from './product-group.entity';
import { Product } from './product.entity';

@Entity({ name: 'product_group_items' })
@Unique(['group', 'product'])
export class ProductGroupItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ProductGroup, (group) => group.items, {
    onDelete: 'CASCADE',
  })
  group: ProductGroup;

  @ManyToOne(() => Product, (product) => product.groupItems, {
    onDelete: 'CASCADE',
  })
  product: Product;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
